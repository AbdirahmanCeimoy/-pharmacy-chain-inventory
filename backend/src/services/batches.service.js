import { z } from 'zod';
import * as repo from '../repositories/batches.repo.js';
import { ValidationError } from '../utils/errors.js';

const listQuerySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  medicineId: z.coerce.number().int().positive().optional(),
  maxDaysToExpiry: z.coerce.number().int().min(0).max(3650).optional(),
  includeExpired: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

function dto(r) {
  return {
    id: r.id,
    medicineId: r.medicine_id,
    medicine: {
      genericName: r.generic_name,
      brandName: r.brand_name,
      form: r.form,
      strength: r.strength,
      unitLabel: r.unit_label,
    },
    branchId: r.branch_id,
    branchCode: r.branch_code,
    branchName: r.branch_name,
    batchNumber: r.batch_number,
    expiryDate: r.expiry_date,
    daysToExpiry: Number(r.days_to_expiry),
    qtyOnHand: Number(r.qty_on_hand),
    unitCost: r.unit_cost,
    stockValue: (Number(r.qty_on_hand) * Number(r.unit_cost)).toFixed(2),
    isBlocked: !!r.is_blocked,
    receivedAt: r.received_at,
  };
}

export async function list(query, actor) {
  const parsed = listQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new ValidationError('Invalid query', parsed.error.flatten().fieldErrors);
  }
  const filters = {
    medicineId: parsed.data.medicineId,
    maxDaysToExpiry: parsed.data.maxDaysToExpiry,
    includeExpired: parsed.data.includeExpired !== 'false',
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  };
  // MANAGER / PHARMACIST are scoped to their branch; OWNER may filter by any branch or omit.
  if (actor.role === 'OWNER') {
    if (parsed.data.branchId) filters.branchId = parsed.data.branchId;
  } else {
    filters.branchId = actor.branchId;
  }
  const rows = await repo.list(filters);
  return rows.map(dto);
}

export async function expirySummary(query, actor) {
  const branchId = actor.role === 'OWNER' ? query.branchId || null : actor.branchId;
  const row = await repo.expirySummary({ branchId: branchId ? Number(branchId) : null });
  return {
    branchId: branchId ? Number(branchId) : null,
    expired: {
      count: Number(row.expired_count ?? 0),
      qty: Number(row.expired_qty ?? 0),
      value: row.expired_value ?? '0',
    },
    in30: {
      count: Number(row.in30_count ?? 0),
      qty: Number(row.in30_qty ?? 0),
      value: row.in30_value ?? '0',
    },
    in60: {
      count: Number(row.in60_count ?? 0),
      qty: Number(row.in60_qty ?? 0),
      value: row.in60_value ?? '0',
    },
    in90: {
      count: Number(row.in90_count ?? 0),
      qty: Number(row.in90_qty ?? 0),
      value: row.in90_value ?? '0',
    },
    total: {
      count: Number(row.total_count ?? 0),
      qty: Number(row.total_qty ?? 0),
      value: row.total_value ?? '0',
    },
  };
}
