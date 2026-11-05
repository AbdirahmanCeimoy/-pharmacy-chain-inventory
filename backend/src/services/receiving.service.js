// Goods receiving.
// Preconditions for POST /api/purchase-orders/:id/receive:
//   - PO is APPROVED or PARTIALLY_RECEIVED
//   - Actor can act on the PO's branch
//
// Per-line rules the service enforces (ValidationError / ConflictError):
//   - qty_received_cumulative <= qty_ordered * 1.10   (110% cap)
//   - expiry_date >= today + 3 months   OR   payload.allow_short_expiry === true
//   - Same (medicine, branch, batch_number) MERGES into the existing batch:
//     qty_on_hand increases; batch's original unit_cost is preserved.
//     (The brief: "The same batch number received again adds to the existing batch.")
//   - Every receive line writes exactly one stock_movements row (RECEIVE, +qty).
//
// After all items apply, we recompute PO status:
//   - All lines fully received             → RECEIVED
//   - Some lines received, at least one <  → PARTIALLY_RECEIVED
//   - Nothing moved                        → status unchanged (no-op receive)
//
// Everything runs inside a single transaction, with the PO row locked FOR UPDATE
// so two managers receiving the same PO at once serialize.

import { z } from 'zod';
import { withTransaction } from '../db/pool.js';
import * as poRepo from '../repositories/purchase_orders.repo.js';
import * as batchRepo from '../repositories/batches.repo.js';
import * as movementRepo from '../repositories/stock_movements.repo.js';
import * as auditRepo from '../repositories/audit.repo.js';
import { ValidationError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors.js';

const MIN_EXPIRY_DAYS = 90; // "at least 3 months in the future"
const MAX_OVER_PCT = 10; // "cannot exceed quantity ordered by more than 10%"

const lineSchema = z.object({
  po_item_id: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().positive().max(1_000_000),
  batch_number: z.string().trim().min(1).max(60),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry_date must be YYYY-MM-DD'),
  actual_unit_cost: z.coerce.number().positive().max(999_999),
});

const receiveSchema = z.object({
  allow_short_expiry: z.boolean().default(false),
  items: z.array(lineSchema).min(1).max(200),
});

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function assertBranchAccess(actor, branchId) {
  if (actor.role === 'OWNER') return;
  if (Number(actor.branchId) !== Number(branchId)) {
    throw new ForbiddenError('You can only act on your own branch');
  }
}

async function loadPoItemsForUpdate(conn, poId) {
  const [rows] = await conn.execute(
    `SELECT id, purchase_order_id, medicine_id, qty_ordered, qty_received, expected_unit_cost
       FROM purchase_order_items
      WHERE purchase_order_id = ?
      ORDER BY id
      FOR UPDATE`,
    [poId]
  );
  return rows;
}

export async function receive(poId, payload, actor) {
  const parsed = receiveSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid receive payload', parsed.error.flatten().fieldErrors);
  }
  const { allow_short_expiry, items } = parsed.data;

  // Pre-validate short expiry out of the transaction — avoids wasting a tx on a user error.
  for (const line of items) {
    if (!allow_short_expiry && daysUntil(line.expiry_date) < MIN_EXPIRY_DAYS) {
      throw new ConflictError(
        `Batch ${line.batch_number} expires in ${daysUntil(line.expiry_date)} days; the 3-month rule needs allow_short_expiry=true`,
        { field: 'expiry_date', value: line.expiry_date, minDays: MIN_EXPIRY_DAYS }
      );
    }
  }

  await withTransaction(async (conn) => {
    const po = await poRepo.findByIdForUpdate(conn, poId);
    if (!po) throw new NotFoundError('Purchase order not found');
    assertBranchAccess(actor, po.branch_id);
    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      throw new ConflictError(`Cannot receive a PO in status ${po.status}`);
    }

    const poItems = await loadPoItemsForUpdate(conn, poId);
    const itemsById = new Map(poItems.map((i) => [i.id, i]));
    // Sort receive lines by po_item_id (matches load order) for deterministic locking.
    const sortedLines = [...items].sort((a, b) => a.po_item_id - b.po_item_id);

    for (const line of sortedLines) {
      const poItem = itemsById.get(line.po_item_id);
      if (!poItem) {
        throw new ValidationError(`po_item_id ${line.po_item_id} is not part of this PO`);
      }
      const newReceived = Number(poItem.qty_received) + Number(line.qty);
      const cap = Math.floor(Number(poItem.qty_ordered) * (1 + MAX_OVER_PCT / 100));
      if (newReceived > cap) {
        throw new ConflictError(
          `Receiving ${line.qty} exceeds the 110% cap for po_item ${line.po_item_id} (ordered ${poItem.qty_ordered}, max ${cap}, already received ${poItem.qty_received})`,
          { field: 'qty', poItemId: line.po_item_id, cap, alreadyReceived: poItem.qty_received }
        );
      }

      // Find existing batch (locked) or create one.
      const existing = await batchRepo.findByIdentity(
        conn,
        poItem.medicine_id,
        po.branch_id,
        line.batch_number
      );
      let batchId;
      if (existing) {
        // Merge rule: keep original unit_cost; just add qty.
        await batchRepo.incrementQty(conn, existing.id, line.qty);
        batchId = existing.id;
      } else {
        batchId = await batchRepo.insertBatch(conn, {
          medicine_id: poItem.medicine_id,
          branch_id: po.branch_id,
          batch_number: line.batch_number,
          expiry_date: line.expiry_date,
          qty_on_hand: line.qty,
          unit_cost: line.actual_unit_cost,
        });
      }

      await movementRepo.insertOne(conn, {
        batch_id: batchId,
        medicine_id: poItem.medicine_id,
        branch_id: po.branch_id,
        qty_delta: line.qty,
        movement_type: 'RECEIVE',
        reference_type: 'PO',
        reference_id: poId,
        performed_by: actor.id,
        note: `PO ${po.id} item ${line.po_item_id}; batch ${line.batch_number}`,
      });

      await conn.execute(
        'UPDATE purchase_order_items SET qty_received = qty_received + ? WHERE id = ?',
        [line.qty, line.po_item_id]
      );
      poItem.qty_received = newReceived;
      if (existing && allow_short_expiry) {
        /* audit noise avoided; already explicit in the request */
      }
    }

    // Compute new PO status.
    const anyPartial = poItems.some((i) => i.qty_received > 0 && i.qty_received < i.qty_ordered);
    const allFull = poItems.every((i) => i.qty_received >= i.qty_ordered);
    const anyReceived = poItems.some((i) => i.qty_received > 0);
    let newStatus = po.status;
    if (allFull) newStatus = 'RECEIVED';
    else if (anyPartial || anyReceived) newStatus = 'PARTIALLY_RECEIVED';

    if (newStatus !== po.status) {
      await poRepo.updateStatus(conn, poId, newStatus);
      await auditRepo.log(conn, actor.id, 'PO_RECEIVED_PROGRESS', 'PO', poId, {
        prevStatus: po.status,
        newStatus,
      });
    }
  });

  // Commit done — re-fetch via a fresh query to return the live state.
  const { getById } = await import('./purchase_orders.service.js');
  return getById(poId, actor);
}
