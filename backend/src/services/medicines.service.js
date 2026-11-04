// Medicines service.
//   - OWNER manages the catalogue. selling_price is held on the medicine row (one place)
//     so "same price at every branch" is enforced structurally, not by business rules.
//   - Identity uniqueness (generic + strength + form + brand) is a DB constraint;
//     we surface ER_DUP_ENTRY as a clean 409.
//   - Deactivation is soft (is_active = 0). Blocked while any batch still has stock.

import { z } from 'zod';
import * as repo from '../repositories/medicines.repo.js';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';

const FORMS = ['TABLET', 'SYRUP', 'INJECTION', 'CAPSULE', 'CREAM', 'DROPS', 'OTHER'];

const createSchema = z.object({
  generic_name: z.string().trim().min(1).max(100),
  brand_name: z.string().trim().min(1).max(100),
  form: z.enum(FORMS),
  strength: z.string().trim().min(1).max(40),
  unit_label: z.string().trim().min(1).max(40),
  category: z.string().trim().max(60).nullable().optional(),
  barcode: z.string().trim().max(40).nullable().optional(),
  selling_price: z.coerce.number().positive().max(999999),
  is_controlled: z.boolean().default(false),
});

const updateSchema = createSchema.partial();

function dto(m) {
  return {
    id: m.id,
    genericName: m.generic_name,
    brandName: m.brand_name,
    form: m.form,
    strength: m.strength,
    unitLabel: m.unit_label,
    category: m.category,
    barcode: m.barcode,
    sellingPrice: m.selling_price, // DECIMAL returned as string; frontend formats
    isControlled: !!m.is_controlled,
    isActive: !!m.is_active,
    createdAt: m.created_at,
  };
}

export async function list(query) {
  const rows = await repo.list(query);
  return rows.map(dto);
}

export async function getById(id) {
  const m = await repo.findById(id);
  if (!m) throw new NotFoundError('Medicine not found');
  return dto(m);
}

function translateDupError(err) {
  if (err.code !== 'ER_DUP_ENTRY') return err;
  if (err.message.includes('uq_medicine_identity')) {
    return new ConflictError(
      'A medicine with this generic name + strength + form + brand already exists',
      { field: 'identity' }
    );
  }
  if (err.message.includes('barcode')) {
    return new ConflictError('A medicine with this barcode already exists', { field: 'barcode' });
  }
  return new ConflictError('Duplicate medicine');
}

export async function create(payload) {
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid medicine payload', parsed.error.flatten().fieldErrors);
  }
  try {
    return dto(await repo.create(parsed.data));
  } catch (err) {
    throw translateDupError(err);
  }
}

export async function update(id, payload) {
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid update payload', parsed.error.flatten().fieldErrors);
  }
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError('Medicine not found');

  const fields = {};
  const data = parsed.data;
  for (const k of [
    'generic_name',
    'brand_name',
    'form',
    'strength',
    'unit_label',
    'category',
    'barcode',
    'selling_price',
  ]) {
    if (k in data) fields[k] = data[k];
  }
  if ('is_controlled' in data) fields.is_controlled = data.is_controlled ? 1 : 0;

  try {
    return dto(await repo.update(id, fields));
  } catch (err) {
    throw translateDupError(err);
  }
}

export async function deactivate(id) {
  const m = await repo.findById(id);
  if (!m) throw new NotFoundError('Medicine not found');
  const stock = await repo.totalStock(id);
  if (stock > 0) {
    throw new ConflictError(
      `Cannot deactivate — ${stock} unit(s) still on hand. Sell or transfer first.`,
      { field: 'stock', value: stock }
    );
  }
  return dto(await repo.setActive(id, false));
}

export async function reactivate(id) {
  const m = await repo.findById(id);
  if (!m) throw new NotFoundError('Medicine not found');
  return dto(await repo.setActive(id, true));
}
