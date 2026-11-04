import { Router } from 'express';
import { z } from 'zod';
import * as svc from '../services/medicines.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();

const listQuerySchema = z.object({
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

router.use(authenticate);

router.get('/', async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return next(new ValidationError('Invalid query', parsed.error.flatten().fieldErrors));
  }
  try {
    const items = await svc.list({
      q: parsed.data.q,
      activeOnly: parsed.data.active === 'true',
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ medicine: await svc.getById(Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.status(201).json({ medicine: await svc.create(req.body) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.json({ medicine: await svc.update(Number(req.params.id), req.body) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/deactivate', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.json({ medicine: await svc.deactivate(Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reactivate', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.json({ medicine: await svc.reactivate(Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

export default router;
