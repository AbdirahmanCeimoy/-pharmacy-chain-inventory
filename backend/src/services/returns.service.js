// Returns.
//   - Only within 7 days of the original sale (brief).
//   - Controlled drugs cannot be returned (brief).
//   - Requires MANAGER (or OWNER) approval — enforced in the route via requireRole.
//   - Per returned unit:
//       * if the originating batch is still valid  → stock is restocked to that batch
//         (increment qty_on_hand, write RETURN movement)
//       * if the originating batch has expired    → unit is written off
//         (no restock, write WRITE_OFF movement)
//   - Return quantity per sale_item is capped by (original qty − already returned).
//
// Everything runs in one transaction. On commit we recompute refund_amount from
// the actual return_items (qty × unit_price).

import { z } from 'zod';
import { pool, withTransaction } from '../db/pool.js';
import * as returnsRepo from '../repositories/returns.repo.js';
import * as salesRepo from '../repositories/sales.repo.js';
import * as batchRepo from '../repositories/batches.repo.js';
import * as movementRepo from '../repositories/stock_movements.repo.js';
import * as auditRepo from '../repositories/audit.repo.js';
import { ValidationError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors.js';

const RETURN_WINDOW_DAYS = 7;

const itemSchema = z.object({
  sale_item_id: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().positive().max(100_000),
});

const createSchema = z.object({
  receipt_no: z.string().trim().min(1).max(30),
  branch_id: z.coerce.number().int().positive().optional(),
  reason: z.string().trim().min(1).max(255),
  items: z.array(itemSchema).min(1).max(50),
});

function assertBranchAccess(actor, branchId) {
  if (actor.role === 'OWNER') return;
  if (Number(actor.branchId) !== Number(branchId)) {
    throw new ForbiddenError('You can only act on your own branch');
  }
}

async function findAllocationsForItems(conn, saleId) {
  const [rows] = await conn.execute(
    `SELECT sba.id, sba.sale_item_id, sba.batch_id, sba.qty AS alloc_qty, sba.unit_cost,
            b.expiry_date, b.batch_number
       FROM sale_batch_allocations sba
       JOIN sale_items si ON si.id = sba.sale_item_id
       JOIN batches b ON b.id = sba.batch_id
      WHERE si.sale_id = ?
      ORDER BY sba.sale_item_id, b.expiry_date ASC, sba.id ASC`,
    [saleId]
  );
  const byItem = new Map();
  for (const r of rows) {
    const arr = byItem.get(r.sale_item_id) || [];
    arr.push(r);
    byItem.set(r.sale_item_id, arr);
  }
  return byItem;
}

export async function create(payload, actor) {
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid return payload', parsed.error.flatten().fieldErrors);
  }

  const branchId = parsed.data.branch_id ?? actor.branchId;
  if (!branchId) throw new ValidationError('branch_id required (OWNER must pick one)');
  assertBranchAccess(actor, branchId);

  const sale = await salesRepo.findByReceipt(branchId, parsed.data.receipt_no);
  if (!sale) throw new NotFoundError(`Receipt ${parsed.data.receipt_no} not found in this branch`);

  // 7-day window check: sale must be within RETURN_WINDOW_DAYS days of NOW.
  const sold = new Date(sale.created_at);
  const ageDays = Math.floor((Date.now() - sold.getTime()) / (1000 * 60 * 60 * 24));
  if (ageDays > RETURN_WINDOW_DAYS) {
    throw new ConflictError(
      `Return window is ${RETURN_WINDOW_DAYS} days — this receipt is ${ageDays} days old`,
      { field: 'receipt_no', ageDays, windowDays: RETURN_WINDOW_DAYS }
    );
  }

  // Pre-tx: pull sale items and check "no controlled drugs".
  const saleItems = await salesRepo.findItemsBySaleId(sale.id);
  const itemsById = new Map(saleItems.map((si) => [si.id, si]));

  for (const r of parsed.data.items) {
    const si = itemsById.get(r.sale_item_id);
    if (!si) {
      throw new ValidationError(
        `sale_item_id ${r.sale_item_id} is not on receipt ${parsed.data.receipt_no}`
      );
    }
    if (si.is_controlled) {
      throw new ConflictError(`${si.generic_name} is a controlled drug and cannot be returned`, {
        field: 'controlled',
        medicineId: si.medicine_id,
      });
    }
  }

  const resultId = await withTransaction(async (conn) => {
    // Lock the sale row so two cashiers can't concurrently over-return.
    const [saleRows] = await conn.execute('SELECT id, status FROM sales WHERE id = ? FOR UPDATE', [
      sale.id,
    ]);
    if (!saleRows[0]) throw new NotFoundError('Sale vanished');

    const allocsByItem = await findAllocationsForItems(conn, sale.id);
    const returnedPerBatch = []; // [{ sale_item_id, batch_id, qty, is_write_off, unit_price }]

    for (const r of parsed.data.items) {
      const si = itemsById.get(r.sale_item_id);
      const already = await returnsRepo.qtyAlreadyReturnedBySaleItem(conn, r.sale_item_id);
      if (already + r.qty > Number(si.qty)) {
        throw new ConflictError(
          `Returning ${r.qty} exceeds remaining on sale_item ${r.sale_item_id} (sold ${si.qty}, already returned ${already})`,
          { saleItemId: r.sale_item_id, alreadyReturned: already, sold: Number(si.qty) }
        );
      }

      // Distribute the return across the item's allocations in FEFO order.
      // This matches how the sale drew them, so the returned units go back to
      // the same batches they came from.
      const allocs = allocsByItem.get(r.sale_item_id) || [];
      let remaining = r.qty;

      for (const a of allocs) {
        if (remaining <= 0) break;
        // Per-allocation remaining: alloc_qty minus whatever has been returned to this batch already.
        const [rowsReturned] = await conn.execute(
          `SELECT COALESCE(SUM(qty), 0) AS n
             FROM return_items
            WHERE sale_item_id = ? AND batch_id = ?`,
          [r.sale_item_id, a.batch_id]
        );
        const alreadyFromThis = Number(rowsReturned[0].n);
        const avail = Number(a.alloc_qty) - alreadyFromThis;
        if (avail <= 0) continue;
        const take = Math.min(remaining, avail);

        const expired = new Date(a.expiry_date) < startOfToday();
        returnedPerBatch.push({
          sale_item_id: r.sale_item_id,
          batch_id: a.batch_id,
          qty: take,
          is_write_off: expired,
          unit_price: Number(si.unit_price),
        });
        remaining -= take;
      }

      if (remaining > 0) {
        // Should not happen — alloc totals equal item.qty — but defend anyway.
        throw new ConflictError(
          `Could not place ${remaining} returned unit(s) of sale_item ${r.sale_item_id} back to a known batch`
        );
      }
    }

    // Compute refund from the per-batch returned rows (uses unit_price snapshot).
    const refund = Number(
      returnedPerBatch.reduce((s, x) => s + x.qty * x.unit_price, 0).toFixed(2)
    );

    const returnId = await returnsRepo.insertReturn(conn, {
      sale_id: sale.id,
      approved_by: actor.id,
      reason: parsed.data.reason,
      refund_amount: refund.toFixed(2),
    });

    for (const x of returnedPerBatch) {
      await returnsRepo.insertReturnItem(conn, {
        return_id: returnId,
        sale_item_id: x.sale_item_id,
        batch_id: x.batch_id,
        qty: x.qty,
        is_write_off: x.is_write_off,
      });

      if (!x.is_write_off) {
        await batchRepo.increment(conn, x.batch_id, x.qty);
        await movementRepo.insertOne(conn, {
          batch_id: x.batch_id,
          medicine_id: itemsById.get(x.sale_item_id).medicine_id,
          branch_id: branchId,
          qty_delta: x.qty,
          movement_type: 'RETURN',
          reference_type: 'RETURN',
          reference_id: returnId,
          performed_by: actor.id,
          note: `Return for receipt ${sale.receipt_no}`,
        });
      } else {
        // Write-off: no restock. Movement row explains the loss.
        await movementRepo.insertOne(conn, {
          batch_id: x.batch_id,
          medicine_id: itemsById.get(x.sale_item_id).medicine_id,
          branch_id: branchId,
          qty_delta: 0, // nothing re-enters stock
          movement_type: 'WRITE_OFF',
          reference_type: 'RETURN',
          reference_id: returnId,
          performed_by: actor.id,
          note: `Expired batch return — written off (receipt ${sale.receipt_no})`,
        });
      }
    }

    await auditRepo.log(conn, actor.id, 'RETURN_APPROVED', 'RETURN', returnId, {
      receipt: sale.receipt_no,
      refund,
    });

    return returnId;
  });

  return getById(resultId, actor);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getById(id, actor) {
  const header = await returnsRepo.findById(id);
  if (!header) throw new NotFoundError('Return not found');
  if (actor.role !== 'OWNER' && Number(actor.branchId) !== Number(header.branch_id)) {
    throw new ForbiddenError();
  }
  const items = await returnsRepo.findItemsByReturnId(id);
  return {
    id: header.id,
    saleId: header.sale_id,
    receiptNo: header.receipt_no,
    branchId: header.branch_id,
    branchCode: header.branch_code,
    approvedBy: header.approved_by,
    approvedByName: header.approved_by_name,
    reason: header.reason,
    refundAmount: header.refund_amount,
    createdAt: header.created_at,
    items: items.map((i) => ({
      id: i.id,
      saleItemId: i.sale_item_id,
      batchId: i.batch_id,
      batchNumber: i.batch_number,
      expiryDate: i.expiry_date,
      qty: Number(i.qty),
      isWriteOff: !!i.is_write_off,
      medicine: {
        genericName: i.generic_name,
        brandName: i.brand_name,
        form: i.form,
        strength: i.strength,
      },
      unitPrice: i.unit_price,
      lineRefund: (Number(i.qty) * Number(i.unit_price)).toFixed(2),
    })),
  };
}

export async function list(query, actor) {
  const filters = { limit: Number(query?.limit) || 50, offset: Number(query?.offset) || 0 };
  if (actor.role === 'OWNER') {
    if (query?.branchId) filters.branchId = Number(query.branchId);
  } else {
    filters.branchId = actor.branchId;
  }
  const rows = await returnsRepo.list(filters);
  return rows.map((r) => ({
    id: r.id,
    saleId: r.sale_id,
    receiptNo: r.receipt_no,
    branchId: r.branch_id,
    branchCode: r.branch_code,
    approvedByName: r.approved_by_name,
    reason: r.reason,
    refundAmount: r.refund_amount,
    createdAt: r.created_at,
  }));
}
