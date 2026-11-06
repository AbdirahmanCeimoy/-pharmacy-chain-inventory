import { Router } from 'express';
import * as svc from '../services/stock_counts.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    res.json({ items: await svc.list(req.query, req.user) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ stockCount: await svc.getById(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.status(201).json({ stockCount: await svc.start(req.body, req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.json({ stockCount: await svc.submit(Number(req.params.id), req.body, req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.json({ stockCount: await svc.cancel(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

export default router;
