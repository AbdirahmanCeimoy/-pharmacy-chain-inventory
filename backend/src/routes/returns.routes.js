import { Router } from 'express';
import * as svc from '../services/returns.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const items = await svc.list(req.query, req.user);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ return: await svc.getById(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

// Manager approval is baked in: only MANAGER / OWNER may create.
router.post('/', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    res.status(201).json({ return: await svc.create(req.body, req.user) });
  } catch (err) {
    next(err);
  }
});

export default router;
