import { pool } from '../src/db/pool.js';
const [em] = await pool.query(
  "SELECT id, body FROM email_outbox WHERE to_email='owner@pharmacy.so' ORDER BY id DESC LIMIT 1"
);
console.log('Latest email row:', em[0]);
const [pr] = await pool.query(
  "SELECT id, user_id, SUBSTRING(otp_hash,1,15) AS h, attempts, used, expires_at FROM password_resets WHERE user_id=(SELECT id FROM users WHERE email='owner@pharmacy.so') ORDER BY id DESC LIMIT 5"
);
console.log('Latest password_resets rows:', pr);
await pool.end();
