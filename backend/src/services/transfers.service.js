// Inter-branch transfer service.
// State machine: REQUESTED → APPROVED → DISPATCHED → RECEIVED
//   REQUESTED/APPROVED → CANCELLED (DISPATCHED is a point of no return)
//
// Who does what:
//   - The TO branch's manager creates the transfer (they want the stock).
//   - If total_value <= HQ_APPROVAL_THRESHOLD ($500) → auto-APPROVED on create.
//   - If total_value >  threshold → stays REQUESTED; OWNER must POST /approve.
//   - The FROM branch's manager (or OWNER) dispatches. Dispatch picks one source
//     batch per item via FEFO (first batch whose qty_on_hand >= qty_requested).
//     If no single batch has enough we refuse and ask them to split the request.
//     Stock leaves sender via TRANSFER_OUT; the item carries batch_number + expiry
//     + unit_cost forward to the receiver.
//   - The TO branch's manager (or OWNER) receives. Qty received may be <= dispatched
//     (shortage). Receiver creates or merges a batch at the TO branch with the SAME
//     batch_number / expiry / unit_cost (feature 7 brief: "with the same batch numbers
//     and expiry"). Stock arrives via TRANSFER_IN.
//
// Between dispatch and receive the stock belongs to neither branch's sellable inventory.

import { z } from 'zod';
import { pool, withTransaction } from '../db/pool.js';
import * as repo from '../repositories/transfers.repo.js';
import * as batchRepo from '../repositories/batches.repo.js';
import * as movementRepo from '../repositories/stock_movements.repo.js';
import * as auditRepo from '../repositories/audit.repo.js';
import { ValidationError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors.js';

export const HQ_APPROVAL_THRESHOLD = 500;

const itemSchema = z.object({
  medicine_id: z.coerce.number().int().positive(),
  qty_requested: z.coerce.number().int().positive().max(100_000),
});

const createSchema = z.object({
  from_branch_id: z.coerce.number().int().positive(),
  to_branch_id: z.coerce.number().int().positive(),
  items: z.array(itemSchema).min(1).max(100),
});

const receiveSchema = z.object({
  items: z
    .array(
      z.object({
        transfer_item_id: z.coerce.number().int().positive(),
        qty_received: z.coerce.number().int().min(0).max(100_000),
      })
    )
    .min(1),
  shortage_note: z.string().trim().max(255).optional(),
});

function headerDto(t) {
  if (!t) return null;
  return {
    id: t.id,
    transferNo: t.transfer_no,
    fromBranchId: t.from_branch_id,
    fromBranchCode: t.from_branch_code,
    fromBranchName: t.from_branch_name,
    toBranchId: t.to_branch_id,
    toBranchCode: t.to_branch_code,
    toBranchName: t.to_branch_name,
    status: t.status,
    totalValue: t.total_value,
    requestedBy: t.requested_by,
    requestedByName: t.requested_by_name,
    approvedBy: t.approved_by,
    approvedByName: t.approved_by_name,
    dispatchedBy: t.dispatched_by,
    dispatchedByName: t.dispatched_by_name,
    receivedBy: t.received_by,
    receivedByName: t.received_by_name,
    shortageNote: t.shortage_note,
    createdAt: t.created_at,
  };
}

function itemDto(i) {
  return {
    id: i.id,
    medicineId: i.medicine_id,
    medicine: {
      genericName: i.generic_name,
      brandName: i.brand_name,
      form: i.form,
      strength: i.strength,
      unitLabel: i.unit_label,
    },
    qtyRequested: Number(i.qty_requested),
    qtyDispatched: Number(i.qty_dispatched),
    qtyReceived: Number(i.qty_received),
    sourceBatchId: i.source_batch_id,
    destBatchNumber: i.dest_batch_number,
    destExpiryDate: i.dest_expiry_date,
    unitCost: i.unit_cost,
  };
}

async function loadFull(id) {
  const header = await repo.findById(id);
  if (!header) throw new NotFoundError('Transfer not found');
  const items = await repo.findItemsByTransferId(id);
  return { ...headerDto(header), items: items.map(itemDto) };
}

function canView(actor, header) {
  if (actor.role === 'OWNER') return true;
  return (
    Number(actor.branchId) === Number(header.from_branch_id) ||
    Number(actor.branchId) === Number(header.to_branch_id)
  );
}

async function estimateValue(conn, items) {
  const medIds = [...new Set(items.map((i) => i.medicine_id))];
  const [prices] = await conn.query('SELECT id, selling_price FROM medicines WHERE id IN (?)', [
    medIds,
  ]);
  const byId = Object.fromEntries(prices.map((p) => [p.id, Number(p.selling_price)]));
  return items.reduce((s, i) => s + (byId[i.medicine_id] ?? 0) * Number(i.qty_requested), 0);
}

export async function create(payload, actor) {
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid transfer payload', parsed.error.flatten().fieldErrors);
  }
  const { from_branch_id, to_branch_id, items } = parsed.data;
  if (from_branch_id === to_branch_id) {
    throw new ValidationError('from_branch_id and to_branch_id must differ');
  }

  // The REQUESTER branch is the TO branch (they want the stock).
  if (actor.role !== 'OWNER' && Number(actor.branchId) !== Number(to_branch_id)) {
    throw new ForbiddenError('A branch can only request a transfer INTO its own branch');
  }

  const id = await withTransaction(async (conn) => {
    const estimatedValue = await estimateValue(conn, items);
    const transferNo = await repo.nextTransferNo(conn, from_branch_id);
    const autoApprove = estimatedValue <= HQ_APPROVAL_THRESHOLD;
    const newId = await repo.insertTransfer(conn, {
      transfer_no: transferNo,
      from_branch_id,
      to_branch_id,
      status: autoApprove ? 'APPROVED' : 'REQUESTED',
      total_value: estimatedValue.toFixed(2),
      requested_by: actor.id,
      approved_by: autoApprove ? actor.id : null,
    });
    for (const i of items) {
      await repo.insertItem(conn, {
        transfer_id: newId,
        medicine_id: i.medicine_id,
        qty_requested: i.qty_requested,
      });
    }
    await auditRepo.log(
      conn,
      actor.id,
      autoApprove ? 'TRANSFER_AUTO_APPROVED' : 'TRANSFER_REQUESTED',
      'TRANSFER',
      newId,
      { total: estimatedValue, needsHQ: !autoApprove }
    );
    return newId;
  });
  return loadFull(id);
}

export async function approve(id, actor) {
  if (actor.role !== 'OWNER') {
    throw new ForbiddenError('Only OWNER can approve transfers');
  }
  await withTransaction(async (conn) => {
    const t = await repo.findByIdForUpdate(conn, id);
    if (!t) throw new NotFoundError('Transfer not found');
    if (t.status !== 'REQUESTED') {
      throw new ConflictError(`Cannot approve a transfer in status ${t.status}`);
    }
    await repo.updateStatus(conn, id, 'APPROVED', { approvedBy: actor.id });
    await auditRepo.log(conn, actor.id, 'TRANSFER_APPROVED', 'TRANSFER', id, {
      total: Number(t.total_value),
    });
  });
  return loadFull(id);
}

export async function dispatch(id, actor) {
  await withTransaction(async (conn) => {
    const t = await repo.findByIdForUpdate(conn, id);
    if (!t) throw new NotFoundError('Transfer not found');
    // Only from_branch's staff (or OWNER) may dispatch.
    if (actor.role !== 'OWNER' && Number(actor.branchId) !== Number(t.from_branch_id)) {
      throw new ForbiddenError('Only the SENDING branch can dispatch this transfer');
    }
    if (t.status !== 'APPROVED') {
      throw new ConflictError(`Cannot dispatch a transfer in status ${t.status}`);
    }

    const items = await repo.findItemsForUpdate(conn, id);
    // Sort by medicine_id to match POS lock order (prevents cross-flow deadlocks).
    const sortedItems = [...items].sort((a, b) => a.medicine_id - b.medicine_id);

    for (const item of sortedItems) {
      const batches = await batchRepo.lockSellableFEFO(conn, item.medicine_id, t.from_branch_id);
      // Choose the earliest-expiry batch that has enough stock in a single batch.
      // Documented limitation: no cross-batch allocations for a transfer line.
      const chosen = batches.find((b) => Number(b.qty_on_hand) >= Number(item.qty_requested));
      if (!chosen) {
        const maxInOne = batches.length
          ? Math.max(...batches.map((b) => Number(b.qty_on_hand)))
          : 0;
        throw new ConflictError(
          `Cannot dispatch ${item.qty_requested} of medicine ${item.medicine_id} from a single batch — max available in one batch is ${maxInOne}. Split into smaller transfer requests.`,
          {
            medicineId: item.medicine_id,
            requested: Number(item.qty_requested),
            maxInOneBatch: maxInOne,
          }
        );
      }
      await batchRepo.decrement(conn, chosen.id, item.qty_requested);
      await movementRepo.insertOne(conn, {
        batch_id: chosen.id,
        medicine_id: item.medicine_id,
        branch_id: t.from_branch_id,
        qty_delta: -Number(item.qty_requested),
        movement_type: 'TRANSFER_OUT',
        reference_type: 'TRANSFER',
        reference_id: id,
        performed_by: actor.id,
        note: `Transfer ${id}`,
      });
      await repo.updateItemOnDispatch(conn, item.id, {
        qty_dispatched: Number(item.qty_requested),
        source_batch_id: chosen.id,
        dest_batch_number: chosen.batch_number,
        dest_expiry_date: chosen.expiry_date,
        unit_cost: chosen.unit_cost,
      });
    }

    await repo.updateStatus(conn, id, 'DISPATCHED', { dispatchedBy: actor.id });
    await auditRepo.log(conn, actor.id, 'TRANSFER_DISPATCHED', 'TRANSFER', id, {
      items: items.length,
    });
  });
  return loadFull(id);
}

export async function receive(id, payload, actor) {
  const parsed = receiveSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid receive payload', parsed.error.flatten().fieldErrors);
  }
  await withTransaction(async (conn) => {
    const t = await repo.findByIdForUpdate(conn, id);
    if (!t) throw new NotFoundError('Transfer not found');
    if (actor.role !== 'OWNER' && Number(actor.branchId) !== Number(t.to_branch_id)) {
      throw new ForbiddenError('Only the RECEIVING branch can receive this transfer');
    }
    if (t.status !== 'DISPATCHED') {
      throw new ConflictError(`Cannot receive a transfer in status ${t.status}`);
    }

    const items = await repo.findItemsForUpdate(conn, id);
    const itemsById = new Map(items.map((i) => [i.id, i]));
    let anyShortage = false;

    for (const r of parsed.data.items) {
      const item = itemsById.get(r.transfer_item_id);
      if (!item) {
        throw new ValidationError(`transfer_item_id ${r.transfer_item_id} is not on this transfer`);
      }
      if (r.qty_received > Number(item.qty_dispatched)) {
        throw new ConflictError(
          `Cannot receive more than dispatched (${item.qty_dispatched}) for item ${r.transfer_item_id}`
        );
      }
      if (r.qty_received < Number(item.qty_dispatched)) anyShortage = true;

      if (r.qty_received > 0) {
        const existing = await batchRepo.findByIdentity(
          conn,
          item.medicine_id,
          t.to_branch_id,
          item.dest_batch_number
        );
        let destBatchId;
        if (existing) {
          await batchRepo.incrementQty(conn, existing.id, r.qty_received);
          destBatchId = existing.id;
        } else {
          destBatchId = await batchRepo.insertBatch(conn, {
            medicine_id: item.medicine_id,
            branch_id: t.to_branch_id,
            batch_number: item.dest_batch_number,
            expiry_date: item.dest_expiry_date,
            qty_on_hand: r.qty_received,
            unit_cost: item.unit_cost,
          });
        }
        await movementRepo.insertOne(conn, {
          batch_id: destBatchId,
          medicine_id: item.medicine_id,
          branch_id: t.to_branch_id,
          qty_delta: r.qty_received,
          movement_type: 'TRANSFER_IN',
          reference_type: 'TRANSFER',
          reference_id: id,
          performed_by: actor.id,
          note: `Transfer ${id}`,
        });
      }
      await repo.updateItemOnReceive(conn, r.transfer_item_id, {
        qty_received: r.qty_received,
      });
    }

    const shortageNote = anyShortage ? parsed.data.shortage_note || 'Shortage recorded' : null;
    await repo.updateStatus(conn, id, 'RECEIVED', {
      receivedBy: actor.id,
      shortageNote,
    });
    await auditRepo.log(conn, actor.id, 'TRANSFER_RECEIVED', 'TRANSFER', id, {
      shortage: anyShortage,
    });
  });
  return loadFull(id);
}

export async function cancel(id, actor) {
  await withTransaction(async (conn) => {
    const t = await repo.findByIdForUpdate(conn, id);
    if (!t) throw new NotFoundError('Transfer not found');
    if (!['REQUESTED', 'APPROVED'].includes(t.status)) {
      throw new ConflictError(`Cannot cancel a transfer in status ${t.status}`);
    }
    if (
      actor.role !== 'OWNER' &&
      Number(actor.branchId) !== Number(t.from_branch_id) &&
      Number(actor.branchId) !== Number(t.to_branch_id)
    ) {
      throw new ForbiddenError();
    }
    await repo.updateStatus(conn, id, 'CANCELLED');
    await auditRepo.log(conn, actor.id, 'TRANSFER_CANCELLED', 'TRANSFER', id, {
      prevStatus: t.status,
    });
  });
  return loadFull(id);
}

export async function getById(id, actor) {
  const header = await repo.findById(id);
  if (!header) throw new NotFoundError('Transfer not found');
  if (!canView(actor, header)) throw new ForbiddenError();
  return loadFull(id);
}

export async function list(query, actor) {
  const filters = { limit: Number(query?.limit) || 50, offset: Number(query?.offset) || 0 };
  if (query?.status) filters.status = query.status;
  if (actor.role === 'OWNER') {
    if (query?.branchId) filters.involvingBranchId = Number(query.branchId);
  } else {
    filters.involvingBranchId = actor.branchId;
  }
  const rows = await repo.list(filters);
  return rows.map(headerDto);
}
