// Users repository — SQL only. No business rules, no logging, no auth checks.
// The service layer is the sole consumer.

import { pool } from '../db/pool.js';

export async function findActiveByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT id, full_name, email, password_hash, role, branch_id, is_active
       FROM users
      WHERE email = ? AND is_active = 1
      LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT id, full_name, email, role, branch_id, is_active
       FROM users
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function touchLastLogin(id) {
  await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
}
