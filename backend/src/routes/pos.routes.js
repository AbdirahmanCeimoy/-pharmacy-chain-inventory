import { Router } from 'express';
import * as svc from '../services/pos.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Only pharmacists + managers may sell; OWNER can also sell (acts on any branch)
// but cannot sell controlled drugs (enforced in the service).
router.post('/sales', requireRole('PHARMACIST', 'MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    const sale = await svc.createSale(req.body, req.user);
    res.status(201).json({ sale });
  } catch (err) {
    next(err);
  }
});

router.get('/sales/:id', async (req, res, next) => {
  try {
    res.json({ sale: await svc.getById(Number(req.params.id), req.user) });
  } catch (err) {
    next(err);
  }
});

// Look up a sale by its receipt number. Scoped by actor's branch (OWNER may pass ?branchId).
router.get('/receipts/:receiptNo', async (req, res, next) => {
  try {
    const branchId =
      req.user.role === 'OWNER' ? Number(req.query.branchId) || null : req.user.branchId;
    if (!branchId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'branchId is required' });
    }
    const sale = await svc.findByReceiptNo(branchId, req.params.receiptNo, req.user);
    if (!sale) return res.status(404).json({ error: 'NOT_FOUND', message: 'Receipt not found' });
    res.json({ sale });
  } catch (err) {
    next(err);
  }
});

router.get('/sales', async (req, res, next) => {
  try {
    const items = await svc.list(req.query, req.user);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

export default router;
