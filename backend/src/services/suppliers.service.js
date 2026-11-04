import { z } from 'zod';
import * as repo from '../repositories/suppliers.repo.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  payment_terms: z.string().trim().max(60).nullable().optional(),
});

const updateSchema = createSchema.partial();

function dto(s) {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    address: s.address,
    paymentTerms: s.payment_terms,
    isActive: !!s.is_active,
    createdAt: s.created_at,
  };
}

export async function list(query) {
  return (await repo.list(query)).map(dto);
}
export async function getById(id) {
  const s = await repo.findById(id);
  if (!s) throw new NotFoundError('Supplier not found');
  return dto(s);
}
export async function create(payload) {
  const p = createSchema.safeParse(payload);
  if (!p.success)
    throw new ValidationError('Invalid supplier payload', p.error.flatten().fieldErrors);
  return dto(await repo.create(p.data));
}
export async function update(id, payload) {
  const p = updateSchema.safeParse(payload);
  if (!p.success)
    throw new ValidationError('Invalid update payload', p.error.flatten().fieldErrors);
  const s = await repo.findById(id);
  if (!s) throw new NotFoundError('Supplier not found');
  return dto(await repo.update(id, p.data));
}
export async function deactivate(id) {
  const s = await repo.findById(id);
  if (!s) throw new NotFoundError('Supplier not found');
  return dto(await repo.setActive(id, false));
}
export async function reactivate(id) {
  const s = await repo.findById(id);
  if (!s) throw new NotFoundError('Supplier not found');
  return dto(await repo.setActive(id, true));
}
