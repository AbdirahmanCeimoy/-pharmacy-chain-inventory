// Audit log writer. Called from services when sensitive actions happen:
// PO_SUBMITTED, PO_AUTO_APPROVED, PO_APPROVED, PO_CANCELLED, TRANSFER_APPROVED,
// RETURN_APPROVED, SALE_VOIDED, PRICE_CHANGED, etc.
// If a transactional connection is passed, the log row joins the same transaction
// as the action — so rolling back the action rolls back its audit entry too.

import { pool } from '../db/pool.js';

export async function log(
  connOrNull,
  userId,
  action,
  entityType,
  entityId = null,
  meta = null,
  ipAddress = null
) {
  const conn = connOrNull || pool;
  await conn.execute(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, meta_json, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId, meta ? JSON.stringify(meta) : null, ipAddress]
  );
}
