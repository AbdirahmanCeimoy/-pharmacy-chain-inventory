import { pool } from '../db/pool.js';

const COLS = 'id, name, phone, address, payment_terms, is_active, created_at';

export async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${COLS} FROM suppliers WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function list({ q, activeOnly = false, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (q) {
    where.push('(name LIKE ? OR phone LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (activeOnly) where.push('is_active = 1');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));
  const [rows] = await pool.query(
    `SELECT ${COLS} FROM suppliers ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

export async function create(data) {
  const [res] = await pool.execute(
    'INSERT INTO suppliers (name, phone, address, payment_terms) VALUES (?, ?, ?, ?)',
    [data.name, data.phone ?? null, data.address ?? null, data.payment_terms ?? null]
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
  await pool.execute(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

export async function setActive(id, isActive) {
  await pool.execute('UPDATE suppliers SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return findById(id);
}
