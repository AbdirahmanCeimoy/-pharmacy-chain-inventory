// Password-reset tokens.

import { pool } from '../db/pool.js';

// Invalidate any outstanding OTPs for a user before issuing a new one.
export async function invalidateActiveForUser(conn, userId) {
  await conn.execute('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', [
    userId,
  ]);
}

export async function insertOtp(conn, { userId, otpHash, ttlMinutes }) {
  // Let the DB compute expires_at = NOW() + ttlMinutes so we don't have to
  // reason about the app's local TZ vs the DB's session TZ.
  const [res] = await conn.execute(
    `INSERT INTO password_resets (user_id, otp_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, otpHash, ttlMinutes]
  );
  return res.insertId;
}

export async function latestActiveForUser(userId) {
  // The (expires_at < NOW()) flag is computed by the DB so we never have to
  // parse the stored datetime in app code (where TZ assumptions break).
  const [rows] = await pool.execute(
    `SELECT id, user_id, otp_hash, attempts, used, reset_token_hash, reset_token_used,
            created_at, expires_at, reset_expires_at,
            (expires_at < NOW()) AS is_expired
       FROM password_resets
      WHERE user_id = ? AND used = 0
      ORDER BY id DESC
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function incrementAttempts(id) {
  await pool.execute('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [id]);
}

export async function markUsed(id) {
  await pool.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [id]);
}

export async function attachResetToken(id, { resetTokenHash, ttlMinutes }) {
  await pool.execute(
    `UPDATE password_resets
        SET used = 1, reset_token_hash = ?, reset_token_used = 0,
            reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
      WHERE id = ?`,
    [resetTokenHash, ttlMinutes, id]
  );
}

export async function findByResetTokenCandidates(userId) {
  // Returns recently-issued reset tokens that are not yet consumed and not expired.
  const [rows] = await pool.execute(
    `SELECT id, user_id, reset_token_hash, reset_token_used, reset_expires_at
       FROM password_resets
      WHERE user_id = ? AND reset_token_hash IS NOT NULL AND reset_token_used = 0
        AND reset_expires_at IS NOT NULL AND reset_expires_at > NOW()
      ORDER BY id DESC
      LIMIT 5`,
    [userId]
  );
  return rows;
}

export async function markResetTokenUsed(id) {
  await pool.execute('UPDATE password_resets SET reset_token_used = 1 WHERE id = ?', [id]);
}

export async function countRecentRequests(userId, minutes) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS n FROM password_resets
      WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [userId, minutes]
  );
  return Number(rows[0].n);
}
