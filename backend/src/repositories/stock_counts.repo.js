// Stock counts repository. SQL only.

import { pool } from '../db/pool.js';

const COUNT_SELECT = `
  SELECT sc.id, sc.branch_id, sc.status, sc.started_by, sc.started_at, sc.completed_at,
         br.code AS branch_code, br.name AS branch_name,
         u.full_name AS started_by_name
    FROM stock_counts sc
    JOIN branches br ON br.id = sc.branch_id
    JOIN users u ON u.id = sc.started_by
`;

export async function insertCount(conn, { branchId, startedBy }) {
  const [res] = await conn.execute(
    "INSERT INTO stock_counts (branch_id, status, started_by) VALUES (?, 'IN_PROGRESS', ?)",
    [branchId, startedBy]
  );
  return res.insertId;
}

// Snapshots every batch for the branch (optionally restricted to a list of medicines)
// that currently has qty_on_hand > 0. physical_qty starts at NULL via a separate
// workflow — we store system_qty at snapshot time so the count is reproducible even
// if stock changes elsewhere before submit.
export async function snapshotBatches(conn, { countId, branchId, medicineIds }) {
  const where = ['b.branch_id = ?', 'b.qty_on_hand > 0'];
  const params = [branchId];
  if (medicineIds && medicineIds.length) {
    where.push(`b.medicine_id IN (${medicineIds.map(() => '?').join(',')})`);
    params.push(...medicineIds);
  }
  const [batches] = await conn.query(
    `SELECT id, medicine_id, qty_on_hand FROM batches b WHERE ${where.join(' AND ')} ORDER BY medicine_id, id`,
    params
  );
  for (const b of batches) {
    await conn.execute(
      `INSERT INTO stock_count_items
         (stock_count_id, batch_id, system_qty, physical_qty, adjustment_qty, reason)
       VALUES (?, ?, ?, ?, 0, 'OTHER')`,
      [countId, b.id, b.qty_on_hand, b.qty_on_hand]
    );
  }
  return batches.length;
}

export async function findById(id) {
  const [rows] = await pool.execute(COUNT_SELECT + ' WHERE sc.id = ?', [id]);
  return rows[0] || null;
}

export async function findByIdForUpdate(conn, id) {
  const [rows] = await conn.execute(
    'SELECT id, branch_id, status FROM stock_counts WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0] || null;
}

export async function findItemsByCountId(countId) {
  const [rows] = await pool.execute(
    `SELECT sci.id, sci.stock_count_id, sci.batch_id, sci.system_qty, sci.physical_qty,
            sci.adjustment_qty, sci.reason, sci.note,
            b.batch_number, b.expiry_date, b.unit_cost, b.medicine_id,
            m.generic_name, m.brand_name, m.form, m.strength, m.unit_label
       FROM stock_count_items sci
       JOIN batches b ON b.id = sci.batch_id
       JOIN medicines m ON m.id = b.medicine_id
      WHERE sci.stock_count_id = ?
      ORDER BY m.generic_name, m.brand_name, b.expiry_date`,
    [countId]
  );
  return rows;
}

export async function findItemsForUpdate(conn, countId) {
  const [rows] = await conn.execute(
    `SELECT sci.id, sci.batch_id, sci.system_qty, b.medicine_id
       FROM stock_count_items sci
       JOIN batches b ON b.id = sci.batch_id
      WHERE sci.stock_count_id = ?
      FOR UPDATE`,
    [countId]
  );
  return rows;
}

export async function updateItem(conn, { id, physical_qty, adjustment_qty, reason, note }) {
  await conn.execute(
    `UPDATE stock_count_items
        SET physical_qty = ?, adjustment_qty = ?, reason = ?, note = ?
      WHERE id = ?`,
    [physical_qty, adjustment_qty, reason, note ?? null, id]
  );
}

export async function markStatus(conn, id, status) {
  await conn.execute(
    `UPDATE stock_counts
        SET status = ?,
            completed_at = IF(? IN ('COMPLETED', 'CANCELLED'), NOW(), completed_at)
      WHERE id = ?`,
    [status, status, id]
  );
}

export async function list({ branchId, status, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (branchId) {
    where.push('sc.branch_id = ?');
    params.push(branchId);
  }
  if (status) {
    where.push('sc.status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));
  const [rows] = await pool.query(
    `${COUNT_SELECT} ${whereSql} ORDER BY sc.started_at DESC, sc.id DESC LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

// Returns the set of medicine_ids that are currently covered by an IN_PROGRESS
// count at this branch. Used by the POS service to block sales.
export async function medicinesBlockedByCount(conn, branchId, medicineIds) {
  if (!medicineIds || medicineIds.length === 0) return new Set();
  const placeholders = medicineIds.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT DISTINCT b.medicine_id
       FROM stock_counts sc
       JOIN stock_count_items sci ON sci.stock_count_id = sc.id
       JOIN batches b ON b.id = sci.batch_id
      WHERE sc.branch_id = ?
        AND sc.status = 'IN_PROGRESS'
        AND b.medicine_id IN (${placeholders})`,
    [branchId, ...medicineIds]
  );
  return new Set(rows.map((r) => Number(r.medicine_id)));
}
