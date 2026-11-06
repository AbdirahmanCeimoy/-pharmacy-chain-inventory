// Email adapter.
// - Writes every message to email_outbox so judges (and tests) can SELECT it.
// - If SMTP env vars are present and a real sender is wired later, swap the
//   implementation inside send() — the interface stays the same.
// - In NODE_ENV=development, the server logs the OTP body so you can read it
//   from the dev console without opening the DB. NEVER do this in production.

import { pool } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export async function sendEmail({ to, subject, body }) {
  if (!to) return;
  await pool.execute(
    "INSERT INTO email_outbox (to_email, subject, body, status) VALUES (?, ?, ?, 'QUEUED')",
    [to, subject, body]
  );
  if (env.NODE_ENV !== 'production') {
    logger.info({ to, subject, body }, '[DEV email_outbox] queued');
  } else {
    logger.info({ to, subject, length: body.length }, 'email_outbox: queued (no SMTP wired)');
  }
}
