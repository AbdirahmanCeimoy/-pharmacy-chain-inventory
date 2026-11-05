// Purchase order service.
// State machine: DRAFT → SUBMITTED → APPROVED → (received flow in Stage 3c) → CLOSED.
//                DRAFT/SUBMITTED/APPROVED → CANCELLED
// HQ approval rule:
//   totalAmount <= HQ_APPROVAL_THRESHOLD (USD 1000) → submit auto-approves to APPROVED
//   totalAmount >  HQ_APPROVAL_THRESHOLD           → submit lands at SUBMITTED;
//                                                    only OWNER can then POST /approve
// Branch scoping:
//   OWNER sees/acts on every branch's POs
//   MANAGER only own branch; PHARMACIST has no PO access
//
// Every state transition writes an audit_log row inside the same transaction.

import { z } from 'zod';
import { withTransaction } from '../db/pool.js';
import * as repo from '../repositories/purchase_orders.repo.js';
import * as auditRepo from '../repositories/audit.repo.js';
import { ValidationError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors.js';

export const HQ_APPROVAL_THRESHOLD = 1000;

const itemSchema = z.object({
  medicine_id: z.coerce.number().int().positive(),
  qty_ordered: z.coerce.number().int().positive().max(100000),
  expected_unit_cost: z.coerce.number().positive().max(999999),
});

const createSchema = z.object({
  branch_id: z.coerce.number().int().positive().optional(),
  supplier_id: z.coerce.number().int().positive(),
  notes: z.string().max(500).optional(),
  items: z.array(itemSchema).min(1).max(200),
});

function headerDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    poNumber: row.po_number,
    branchId: row.branch_id,
    branchCode: row.branch_code,
    branchName: row.branch_name,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    status: row.status,
    totalAmount: row.total_amount,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    approvedBy: row.approved_by,
    approvedByName: row.approved_by_name,
    approvedAt: row.approved_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function itemDto(row) {
  return {
    id: row.id,
    medicineId: row.medicine_id,
    medicine: {
      genericName: row.generic_name,
      brandName: row.brand_name,
      form: row.form,
      strength: row.strength,
      unitLabel: row.unit_label,
    },
    qtyOrdered: row.qty_ordered,
    qtyReceived: row.qty_received,
    expectedUnitCost: row.expected_unit_cost,
    lineTotal: (Number(row.qty_ordered) * Number(row.expected_unit_cost)).toFixed(2),
  };
}

function assertBranchAccess(actor, branchId) {
  if (actor.role === 'OWNER') return;
  if (Number(actor.branchId) !== Number(branchId)) {
    throw new ForbiddenError('You can only act on your own branch');
  }
}

async function loadFull(id) {
  const header = await repo.findById(id);
  if (!header) throw new NotFoundError('Purchase order not found');
  const items = await repo.findItemsByPoId(id);
  return { ...headerDto(header), items: items.map(itemDto) };
}

export async function getById(id, actor) {
  const header = await repo.findById(id);
  if (!header) throw new NotFoundError('Purchase order not found');
  assertBranchAccess(actor, header.branch_id);
  return loadFull(id);
}

export async function list(actor, query = {}) {
  const filters = {
    status: query.status,
    q: query.q,
    limit: query.limit,
    offset: query.offset,
  };
  if (actor.role === 'OWNER') {
    if (query.branchId) filters.branchId = query.branchId;
  } else {
    filters.branchId = actor.branchId;
  }
  const rows = await repo.list(filters);
  return rows.map(headerDto);
}

export async function create(payload, actor) {
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid PO payload', parsed.error.flatten().fieldErrors);
  }
  const branchId = parsed.data.branch_id ?? actor.branchId;
  if (!branchId) {
    throw new ValidationError('branch_id is required (OWNER must pick one)');
  }
  assertBranchAccess(actor, branchId);

  const total = parsed.data.items.reduce(
    (sum, i) => sum + Number(i.qty_ordered) * Number(i.expected_unit_cost),
    0
  );

  const poId = await withTransaction(async (conn) => {
    const poNumber = await repo.nextPoNumber(conn, branchId);
    const id = await repo.insertPO(conn, {
      po_number: poNumber,
      branch_id: branchId,
      supplier_id: parsed.data.supplier_id,
      total_amount: total.toFixed(2),
      created_by: actor.id,
      notes: parsed.data.notes,
    });
    for (const item of parsed.data.items) {
      await repo.insertItem(conn, id, item);
    }
    return id;
  });

  return loadFull(poId);
}

// Note: loadFull() reads through the pool, which is a SEPARATE connection from the
// transaction. Under REPEATABLE READ, a read on the pool connection sees the
// pre-transaction snapshot until our tx commits. So we commit first, then re-fetch.

export async function submit(id, actor) {
  await withTransaction(async (conn) => {
    const po = await repo.findByIdForUpdate(conn, id);
    if (!po) throw new NotFoundError('Purchase order not found');
    assertBranchAccess(actor, po.branch_id);
    if (po.status !== 'DRAFT') {
      throw new ConflictError(`Cannot submit a PO in status ${po.status}`);
    }
    const total = Number(po.total_amount);
    if (total <= HQ_APPROVAL_THRESHOLD) {
      await repo.updateStatus(conn, id, 'APPROVED', { approvedBy: actor.id });
      await auditRepo.log(conn, actor.id, 'PO_AUTO_APPROVED', 'PO', id, { total });
    } else {
      await repo.updateStatus(conn, id, 'SUBMITTED');
      await auditRepo.log(conn, actor.id, 'PO_SUBMITTED', 'PO', id, { total, needsHQ: true });
    }
  });
  return loadFull(id);
}

export async function approve(id, actor) {
  if (actor.role !== 'OWNER') {
    throw new ForbiddenError('Only OWNER can approve purchase orders');
  }
  await withTransaction(async (conn) => {
    const po = await repo.findByIdForUpdate(conn, id);
    if (!po) throw new NotFoundError('Purchase order not found');
    if (po.status !== 'SUBMITTED') {
      throw new ConflictError(`Cannot approve a PO in status ${po.status}`);
    }
    await repo.updateStatus(conn, id, 'APPROVED', { approvedBy: actor.id });
    await auditRepo.log(conn, actor.id, 'PO_APPROVED', 'PO', id, {
      total: Number(po.total_amount),
    });
  });
  return loadFull(id);
}

export async function cancel(id, actor) {
  await withTransaction(async (conn) => {
    const po = await repo.findByIdForUpdate(conn, id);
    if (!po) throw new NotFoundError('Purchase order not found');
    assertBranchAccess(actor, po.branch_id);
    if (['RECEIVED', 'CLOSED', 'CANCELLED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      throw new ConflictError(`Cannot cancel a PO in status ${po.status}`);
    }
    await repo.updateStatus(conn, id, 'CANCELLED');
    await auditRepo.log(conn, actor.id, 'PO_CANCELLED', 'PO', id, { prevStatus: po.status });
  });
  return loadFull(id);
}
