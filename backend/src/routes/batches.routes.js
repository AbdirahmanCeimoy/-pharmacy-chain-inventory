import { Router } from 'express';
import * as svc from '../services/batches.service.js';
import { authenticate } from '../middleware/auth.js';

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

router.get('/expiry-summary', async (req, res, next) => {
  try {
    const summary = await svc.expirySummary(req.query, req.user);
    res.json({ summary });
  } catch (err) {
    next(err);
  }
});

export default router;
