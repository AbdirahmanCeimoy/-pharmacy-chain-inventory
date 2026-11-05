// Returns repository. SQL only.
// On a return, we need per-sale_item allocations to know which batches to credit.

import { pool } from '../db/pool.js';

export async function insertReturn(conn, data) {
  const [res] = await conn.execute(
    `INSERT INTO returns (sale_id, approved_by, reason, refund_amount)
     VALUES (?, ?, ?, ?)`,
    [data.sale_id, data.approved_by, data.reason, data.refund_amount]
  );
  return res.insertId;
}

export async function insertReturnItem(conn, data) {
  await conn.execute(
    `INSERT INTO return_items (return_id, sale_item_id, batch_id, qty, is_write_off)
     VALUES (?, ?, ?, ?, ?)`,
    [data.return_id, data.sale_item_id, data.batch_id, data.qty, data.is_write_off ? 1 : 0]
  );
}

export async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT r.id, r.sale_id, r.approved_by, r.reason, r.refund_amount, r.created_at,
            s.receipt_no, s.branch_id, b.code AS branch_code, u.full_name AS approved_by_name
       FROM returns r
       JOIN sales s ON s.id = r.sale_id
       JOIN branches b ON b.id = s.branch_id
       JOIN users u ON u.id = r.approved_by
      WHERE r.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function findItemsByReturnId(returnId) {
  const [rows] = await pool.execute(
    `SELECT ri.id, ri.return_id, ri.sale_item_id, ri.batch_id, ri.qty, ri.is_write_off,
            si.medicine_id, m.generic_name, m.brand_name, m.form, m.strength,
            b.batch_number, b.expiry_date, si.unit_price
       FROM return_items ri
       JOIN sale_items si ON si.id = ri.sale_item_id
       JOIN medicines m ON m.id = si.medicine_id
       JOIN batches b ON b.id = ri.batch_id
      WHERE ri.return_id = ?
      ORDER BY ri.id`,
    [returnId]
  );
  return rows;
}

export async function qtyAlreadyReturnedBySaleItem(conn, saleItemId) {
  const [rows] = await conn.execute(
    'SELECT COALESCE(SUM(qty), 0) AS n FROM return_items WHERE sale_item_id = ?',
    [saleItemId]
  );
  return Number(rows[0].n);
}

export async function list({ branchId, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (branchId) {
    where.push('s.branch_id = ?');
    params.push(branchId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));
  const [rows] = await pool.query(
    `SELECT r.id, r.sale_id, r.reason, r.refund_amount, r.created_at,
            s.receipt_no, s.branch_id, b.code AS branch_code,
            u.full_name AS approved_by_name
       FROM returns r
       JOIN sales s ON s.id = r.sale_id
       JOIN branches b ON b.id = s.branch_id
       JOIN users u ON u.id = r.approved_by
       ${whereSql}
      ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}
