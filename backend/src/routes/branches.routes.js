// Branches: read-only for the frontend's branch pickers (PO create for OWNER,
// transfer source/destination in Stage 4). Full CRUD is not a Project 09 feature —
// branches are a config concern seeded at install time.

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, code, name, city, phone, is_active FROM branches ORDER BY name ASC'
    );
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        city: r.city,
        phone: r.phone,
        isActive: !!r.is_active,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
