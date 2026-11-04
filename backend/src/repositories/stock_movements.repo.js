// stock_movements is append-only. The only operation in production code is insertOne().
// Reads are for reports and the audit trail.

import { pool } from '../db/pool.js';

export async function insertOne(conn, data) {
  await conn.execute(
    `INSERT INTO stock_movements
       (batch_id, medicine_id, branch_id, qty_delta, movement_type, reference_type,
        reference_id, performed_by, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.batch_id,
      data.medicine_id,
      data.branch_id,
      data.qty_delta,
      data.movement_type,
      data.reference_type,
      data.reference_id,
      data.performed_by,
      data.note ?? null,
    ]
  );
}

export async function listByReference(referenceType, referenceId) {
  const [rows] = await pool.execute(
    `SELECT id, batch_id, medicine_id, branch_id, qty_delta, movement_type,
            reference_type, reference_id, performed_by, note, created_at
       FROM stock_movements
      WHERE reference_type = ? AND reference_id = ?
      ORDER BY id`,
    [referenceType, referenceId]
  );
  return rows;
}

export async function countByBatch(batchId) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS n FROM stock_movements WHERE batch_id = ?',
    [batchId]
  );
  return Number(rows[0].n);
}
