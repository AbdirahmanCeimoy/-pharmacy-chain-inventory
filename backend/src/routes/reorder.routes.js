import { Router } from 'express';
import * as svc from '../services/reorder.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    res.json(await svc.suggestions(req.query, req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
