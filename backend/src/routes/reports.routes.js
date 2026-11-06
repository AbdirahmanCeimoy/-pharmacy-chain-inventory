import { Router } from 'express';
import * as svc from '../services/reports.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/dashboard', async (req, res, next) => {
  try {
    res.json(await svc.dashboardSummary(req.user));
  } catch (err) {
    next(err);
  }
});

router.get('/profit', async (req, res, next) => {
  try {
    res.json(await svc.profitByBranch(req.query, req.user));
  } catch (err) {
    next(err);
  }
});

router.get('/expiry-loss', async (req, res, next) => {
  try {
    res.json(await svc.expiryLoss(req.query, req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
