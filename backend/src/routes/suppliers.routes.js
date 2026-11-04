import { Router } from 'express';
import { z } from 'zod';
import * as svc from '../services/suppliers.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

const listQuerySchema = z.object({
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/', async (req, res, next) => {
  const p = listQuerySchema.safeParse(req.query);
  if (!p.success) return next(new ValidationError('Invalid query', p.error.flatten().fieldErrors));
  try {
    const items = await svc.list({
      q: p.data.q,
      activeOnly: p.data.active === 'true',
      limit: p.data.limit,
      offset: p.data.offset,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ supplier: await svc.getById(Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.status(201).json({ supplier: await svc.create(req.body) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.json({ supplier: await svc.update(Number(req.params.id), req.body) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/deactivate', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.json({ supplier: await svc.deactivate(Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reactivate', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.json({ supplier: await svc.reactivate(Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

export default router;
