// Stock counts (feature 11).
//   Start: MANAGER or OWNER creates an IN_PROGRESS count for their branch.
//     - Snapshots every batch currently in that branch with qty_on_hand > 0
//       (optional: restrict to specific medicines). system_qty = qty_on_hand at
//       the moment of snapshot, so the count is reproducible.
//   Submit: counter enters physical_qty + reason per line. adjustment_qty =
//     physical - system. batches.qty_on_hand set to physical. For every non-zero
//     adjustment a stock_movements row is written (ADJUST, qty_delta = adjustment).
//     Count marked COMPLETED.
//   Cancel: no adjustments; count marked CANCELLED.
//   Sales block: while a count is IN_PROGRESS, the POS service rejects sales
//     for any medicine covered by the count (medicinesBlockedByCount helper).

import { z } from 'zod';
import { withTransaction } from '../db/pool.js';
import * as repo from '../repositories/stock_counts.repo.js';
import * as movementRepo from '../repositories/stock_movements.repo.js';
import * as auditRepo from '../repositories/audit.repo.js';
import { ValidationError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors.js';

const REASONS = ['DAMAGED', 'LOST', 'COUNTING_ERROR', 'THEFT', 'EXPIRED', 'OTHER'];

const startSchema = z.object({
  branch_id: z.coerce.number().int().positive().optional(),
  medicine_ids: z.array(z.coerce.number().int().positive()).optional(),
});

const submitItemSchema = z.object({
  stock_count_item_id: z.coerce.number().int().positive(),
  physical_qty: z.coerce.number().int().min(0).max(1_000_000),
  reason: z.enum(REASONS).optional(),
  note: z.string().trim().max(255).optional(),
});

const submitSchema = z.object({
  items: z.array(submitItemSchema).min(1),
});

function assertBranchAccess(actor, branchId) {
  if (actor.role === 'OWNER') return;
  if (Number(actor.branchId) !== Number(branchId)) {
    throw new ForbiddenError('You can only act on your own branch');
  }
}

function headerDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    branchId: row.branch_id,
    branchCode: row.branch_code,
    branchName: row.branch_name,
    status: row.status,
    startedBy: row.started_by,
    startedByName: row.started_by_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function itemDto(row) {
  return {
    id: row.id,
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    unitCost: row.unit_cost,
    medicineId: row.medicine_id,
    medicine: {
      genericName: row.generic_name,
      brandName: row.brand_name,
      form: row.form,
      strength: row.strength,
      unitLabel: row.unit_label,
    },
    systemQty: Number(row.system_qty),
    physicalQty: Number(row.physical_qty),
    adjustmentQty: Number(row.adjustment_qty),
    reason: row.reason,
    note: row.note,
  };
}

async function loadFull(id) {
  const header = await repo.findById(id);
  if (!header) throw new NotFoundError('Stock count not found');
  const items = await repo.findItemsByCountId(id);
  return { ...headerDto(header), items: items.map(itemDto) };
}

export async function start(payload, actor) {
  const parsed = startSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid payload', parsed.error.flatten().fieldErrors);
  }
  const branchId = parsed.data.branch_id ?? actor.branchId;
  if (!branchId) throw new ValidationError('branch_id required (OWNER must pick one)');
  assertBranchAccess(actor, branchId);

  const id = await withTransaction(async (conn) => {
    // Refuse to start if another IN_PROGRESS count exists for this branch.
    const [open] = await conn.execute(
      "SELECT id FROM stock_counts WHERE branch_id = ? AND status = 'IN_PROGRESS' LIMIT 1",
      [branchId]
    );
    if (open.length) {
      throw new ConflictError(
        `Another stock count (#${open[0].id}) is already in progress for this branch`
      );
    }
    const countId = await repo.insertCount(conn, { branchId, startedBy: actor.id });
    const snapshotted = await repo.snapshotBatches(conn, {
      countId,
      branchId,
      medicineIds: parsed.data.medicine_ids,
    });
    if (snapshotted === 0) {
      throw new ConflictError('No batches with stock to count in this branch');
    }
    await auditRepo.log(conn, actor.id, 'STOCK_COUNT_STARTED', 'STOCK_COUNT', countId, {
      branchId,
      batches: snapshotted,
    });
    return countId;
  });
  return loadFull(id);
}

export async function submit(id, payload, actor) {
  const parsed = submitSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid submit payload', parsed.error.flatten().fieldErrors);
  }

  await withTransaction(async (conn) => {
    const header = await repo.findByIdForUpdate(conn, id);
    if (!header) throw new NotFoundError('Stock count not found');
    assertBranchAccess(actor, header.branch_id);
    if (header.status !== 'IN_PROGRESS') {
      throw new ConflictError(`Cannot submit a stock count in status ${header.status}`);
    }

    const existing = await repo.findItemsForUpdate(conn, id);
    const byId = new Map(existing.map((r) => [r.id, r]));

    for (const line of parsed.data.items) {
      const row = byId.get(line.stock_count_item_id);
      if (!row) {
        throw new ValidationError(
          `stock_count_item_id ${line.stock_count_item_id} is not on this count`
        );
      }
      const adjustment = Number(line.physical_qty) - Number(row.system_qty);
      if (adjustment !== 0 && !line.reason) {
        throw new ValidationError(
          `A reason is required for any non-zero adjustment (item ${line.stock_count_item_id})`
        );
      }

      await repo.updateItem(conn, {
        id: line.stock_count_item_id,
        physical_qty: line.physical_qty,
        adjustment_qty: adjustment,
        reason: line.reason ?? 'OTHER',
        note: line.note,
      });

      if (adjustment !== 0) {
        // Apply to batch and record the movement.
        await conn.execute('UPDATE batches SET qty_on_hand = ? WHERE id = ?', [
          line.physical_qty,
          row.batch_id,
        ]);
        await movementRepo.insertOne(conn, {
          batch_id: row.batch_id,
          medicine_id: row.medicine_id,
          branch_id: header.branch_id,
          qty_delta: adjustment,
          movement_type: 'ADJUST',
          reference_type: 'COUNT',
          reference_id: id,
          performed_by: actor.id,
          note: `Stock count adjustment · ${line.reason ?? 'OTHER'}${line.note ? ' · ' + line.note : ''}`,
        });
      }
    }

    await repo.markStatus(conn, id, 'COMPLETED');
    await auditRepo.log(conn, actor.id, 'STOCK_COUNT_COMPLETED', 'STOCK_COUNT', id, {});
  });
  return loadFull(id);
}

export async function cancel(id, actor) {
  await withTransaction(async (conn) => {
    const header = await repo.findByIdForUpdate(conn, id);
    if (!header) throw new NotFoundError('Stock count not found');
    assertBranchAccess(actor, header.branch_id);
    if (header.status !== 'IN_PROGRESS') {
      throw new ConflictError(`Cannot cancel a stock count in status ${header.status}`);
    }
    await repo.markStatus(conn, id, 'CANCELLED');
    await auditRepo.log(conn, actor.id, 'STOCK_COUNT_CANCELLED', 'STOCK_COUNT', id, {});
  });
  return loadFull(id);
}

export async function getById(id, actor) {
  const header = await repo.findById(id);
  if (!header) throw new NotFoundError('Stock count not found');
  assertBranchAccess(actor, header.branch_id);
  return loadFull(id);
}

export async function list(query, actor) {
  const filters = {
    status: query?.status,
    limit: Number(query?.limit) || 50,
    offset: Number(query?.offset) || 0,
  };
  if (actor.role === 'OWNER') {
    if (query?.branchId) filters.branchId = Number(query.branchId);
  } else {
    filters.branchId = actor.branchId;
  }
  const rows = await repo.list(filters);
  return rows.map(headerDto);
}
