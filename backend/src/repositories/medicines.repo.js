// Medicines repository. SQL only — no business rules.

import { pool } from '../db/pool.js';

const COLS = `id, generic_name, brand_name, form, strength, unit_label, category,
              barcode, selling_price, is_controlled, is_active, created_at`;

export async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${COLS} FROM medicines WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function list({ q, activeOnly = false, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (q) {
    where.push('(generic_name LIKE ? OR brand_name LIKE ? OR barcode = ?)');
    params.push(`%${q}%`, `%${q}%`, q);
  }
  if (activeOnly) where.push('is_active = 1');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));
  const [rows] = await pool.query(
    `SELECT ${COLS}
       FROM medicines
       ${whereSql}
      ORDER BY generic_name ASC, brand_name ASC
      LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

export async function create(data) {
  const [res] = await pool.execute(
    `INSERT INTO medicines
       (generic_name, brand_name, form, strength, unit_label, category, barcode,
        selling_price, is_controlled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.generic_name,
      data.brand_name,
      data.form,
      data.strength,
      data.unit_label,
      data.category ?? null,
      data.barcode ?? null,
      data.selling_price,
      data.is_controlled ? 1 : 0,
    ]
  );
  return findById(res.insertId);
}

export async function update(id, fields) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    params.push(v);
  }
  if (!sets.length) return findById(id);
  params.push(id);
  await pool.execute(`UPDATE medicines SET ${sets.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

export async function setActive(id, isActive) {
  await pool.execute('UPDATE medicines SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return findById(id);
}

// Used by the deactivate guard: a medicine can't be hidden while it still has stock.
export async function totalStock(medicineId) {
  const [rows] = await pool.execute(
    'SELECT COALESCE(SUM(qty_on_hand), 0) AS total FROM batches WHERE medicine_id = ?',
    [medicineId]
  );
  return Number(rows[0]?.total ?? 0);
}
