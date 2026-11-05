// SMS adapter. The mock writes to sms_outbox so judges can SELECT * on the
// outbox and see the message that would have been sent — no network calls.
// A real adapter would read the outbox (or be called directly) and talk to
// an SMS provider.

import { pool } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export async function send(toPhone, body) {
  if (env.SMS_DRIVER !== 'mock') {
    throw new Error(`Unknown SMS driver: ${env.SMS_DRIVER}`);
  }
  if (!toPhone) return;
  await pool.execute("INSERT INTO sms_outbox (to_phone, body, status) VALUES (?, ?, 'QUEUED')", [
    toPhone,
    body,
  ]);
  logger.debug({ toPhone, length: body.length }, 'mock SMS queued to outbox');
}
