import { Router } from 'express';
import { z } from 'zod';
import * as svc from '../services/purchase_orders.service.js';
import * as receivingSvc from '../services/receiving.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

const PO_STATUS = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
];

const listQuerySchema = z.object({
  status: z.enum(PO_STATUS).optional(),
  branchId: z.coerce.number().int().positive().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/', async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return next(new ValidationError('Invalid query', parsed.error.flatten().fieldErrors));
  }
  try {
    const items = await svc.list(req.user, parsed.data);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ purchaseOrder: await svc.getById(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.status(201).json({ purchaseOrder: await svc.create(req.body, req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.json({ purchaseOrder: await svc.submit(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/approve', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.json({ purchaseOrder: await svc.approve(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.json({ purchaseOrder: await svc.cancel(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/receive', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    const po = await receivingSvc.receive(Number(req.params.id), req.body, req.user);
    res.json({ purchaseOrder: po });
  } catch (err) {
    next(err);
  }
});

export default router;
