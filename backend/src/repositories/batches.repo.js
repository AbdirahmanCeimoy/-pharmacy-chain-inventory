// Batches repository. SQL only.
// The FEFO lock on the POS path (Stage 4) will use lockSellableFEFO(). For now
// we need: find-or-create-by-batch-number for receiving, list for the UI, and an
// expiry summary query for the dashboard.

import { pool } from '../db/pool.js';

const BATCH_COLS = `b.id, b.medicine_id, b.branch_id, b.batch_number, b.expiry_date,
                    b.qty_on_hand, b.unit_cost, b.received_at, b.is_blocked`;

// ------------------------------------------------------------
// FEFO lock + deduct — the operations the POS service calls under a transaction.
// ------------------------------------------------------------

// Lock all sellable batches for this (medicine, branch) in deterministic FEFO order.
// InnoDB's FOR UPDATE on a SELECT reads the LATEST committed data (not the tx snapshot)
// and takes row locks. Two concurrent cashiers lock these rows in the SAME order
// (expiry_date, id), so they serialize on the earliest-expiring batch instead of
// deadlocking. Index idx_batch_fefo guarantees server-side ordering matches.
export async function lockSellableFEFO(conn, medicineId, branchId) {
  const [rows] = await conn.execute(
    `SELECT id, medicine_id, branch_id, batch_number, expiry_date, qty_on_hand, unit_cost
       FROM batches
      WHERE medicine_id = ?
        AND branch_id   = ?
        AND is_blocked  = 0
        AND expiry_date > CURDATE()
        AND qty_on_hand > 0
      ORDER BY expiry_date ASC, id ASC
      FOR UPDATE`,
    [medicineId, branchId]
  );
  return rows;
}

// Decrement with a safety belt: only decrements if enough stock remains.
// With the lock from lockSellableFEFO already held, the guard is theoretical
// — but if anything ever slips past the lock, this (a) cannot go negative and
// (b) throws, forcing the whole transaction to roll back.
export async function decrement(conn, batchId, qty) {
  const [res] = await conn.execute(
    'UPDATE batches SET qty_on_hand = qty_on_hand - ? WHERE id = ? AND qty_on_hand >= ?',
    [qty, batchId, qty]
  );
  if (res.affectedRows !== 1) {
    throw new Error(`Batch ${batchId} decrement failed (guard tripped — concurrent change?)`);
  }
}

// Reverse — used by returns in a later stage.
export async function increment(conn, batchId, qty) {
  await conn.execute('UPDATE batches SET qty_on_hand = qty_on_hand + ? WHERE id = ?', [
    qty,
    batchId,
  ]);
}

// ------------------------------------------------------------

export async function findByIdentity(conn, medicineId, branchId, batchNumber) {
  const [rows] = await conn.execute(
    `SELECT id, medicine_id, branch_id, batch_number, expiry_date, qty_on_hand, unit_cost
       FROM batches
      WHERE medicine_id = ? AND branch_id = ? AND batch_number = ?
      FOR UPDATE`,
    [medicineId, branchId, batchNumber]
  );
  return rows[0] || null;
}

export async function insertBatch(conn, data) {
  const [res] = await conn.execute(
    `INSERT INTO batches (medicine_id, branch_id, batch_number, expiry_date, qty_on_hand, unit_cost)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.medicine_id,
      data.branch_id,
      data.batch_number,
      data.expiry_date,
      data.qty_on_hand,
      data.unit_cost,
    ]
  );
  return res.insertId;
}

export async function incrementQty(conn, batchId, qty) {
  await conn.execute('UPDATE batches SET qty_on_hand = qty_on_hand + ? WHERE id = ?', [
    qty,
    batchId,
  ]);
}

export async function list({
  branchId,
  medicineId,
  maxDaysToExpiry,
  includeExpired = true,
  limit = 500,
  offset = 0,
} = {}) {
  const where = ['b.qty_on_hand > 0'];
  const params = [];
  if (branchId) {
    where.push('b.branch_id = ?');
    params.push(branchId);
  }
  if (medicineId) {
    where.push('b.medicine_id = ?');
    params.push(medicineId);
  }
  if (maxDaysToExpiry != null) {
    where.push('b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)');
    params.push(maxDaysToExpiry);
  }
  if (!includeExpired) {
    where.push('b.expiry_date > CURDATE()');
  }
  params.push(Number(limit), Number(offset));

  const [rows] = await pool.query(
    `SELECT ${BATCH_COLS},
            m.generic_name, m.brand_name, m.form, m.strength, m.unit_label,
            br.code AS branch_code, br.name AS branch_name,
            DATEDIFF(b.expiry_date, CURDATE()) AS days_to_expiry
       FROM batches b
       JOIN medicines m  ON m.id  = b.medicine_id
       JOIN branches  br ON br.id = b.branch_id
      WHERE ${where.join(' AND ')}
      ORDER BY b.expiry_date ASC, b.id ASC
      LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

// Three-bucket expiry summary across one branch (or all, when branchId is null).
// Returns one row per bucket: 30-day, 60-day (30-60), 90-day (60-90), expired.
export async function expirySummary({ branchId } = {}) {
  const params = [];
  let branchFilter = '';
  if (branchId) {
    branchFilter = 'AND b.branch_id = ?';
    params.push(branchId);
  }
  const [rows] = await pool.query(
    `SELECT
       SUM(b.expiry_date < CURDATE()) AS expired_count,
       COALESCE(SUM(IF(b.expiry_date < CURDATE(), b.qty_on_hand, 0)), 0) AS expired_qty,
       COALESCE(SUM(IF(b.expiry_date < CURDATE(), b.qty_on_hand * b.unit_cost, 0)), 0) AS expired_value,

       SUM(b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS in30_count,
       COALESCE(SUM(IF(b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY), b.qty_on_hand, 0)), 0) AS in30_qty,
       COALESCE(SUM(IF(b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY), b.qty_on_hand * b.unit_cost, 0)), 0) AS in30_value,

       SUM(b.expiry_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY) AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)) AS in60_count,
       COALESCE(SUM(IF(b.expiry_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY) AND DATE_ADD(CURDATE(), INTERVAL 60 DAY), b.qty_on_hand, 0)), 0) AS in60_qty,
       COALESCE(SUM(IF(b.expiry_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY) AND DATE_ADD(CURDATE(), INTERVAL 60 DAY), b.qty_on_hand * b.unit_cost, 0)), 0) AS in60_value,

       SUM(b.expiry_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 61 DAY) AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)) AS in90_count,
       COALESCE(SUM(IF(b.expiry_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 61 DAY) AND DATE_ADD(CURDATE(), INTERVAL 90 DAY), b.qty_on_hand, 0)), 0) AS in90_qty,
       COALESCE(SUM(IF(b.expiry_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 61 DAY) AND DATE_ADD(CURDATE(), INTERVAL 90 DAY), b.qty_on_hand * b.unit_cost, 0)), 0) AS in90_value,

       COUNT(*)      AS total_count,
       COALESCE(SUM(b.qty_on_hand), 0)              AS total_qty,
       COALESCE(SUM(b.qty_on_hand * b.unit_cost), 0) AS total_value
       FROM batches b
      WHERE b.qty_on_hand > 0
        ${branchFilter}`,
    params
  );
  return rows[0];
}
