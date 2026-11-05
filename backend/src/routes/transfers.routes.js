import { Router } from 'express';
import * as svc from '../services/transfers.service.js';
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
    res.json({ transfer: await svc.getById(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.status(201).json({ transfer: await svc.create(req.body, req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/approve', requireRole('OWNER'), async (req, res, next) => {
  try {
    res.json({ transfer: await svc.approve(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/dispatch', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.json({ transfer: await svc.dispatch(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/receive', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.json({ transfer: await svc.receive(Number(req.params.id), req.body, req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.json({ transfer: await svc.cancel(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

export default router;
