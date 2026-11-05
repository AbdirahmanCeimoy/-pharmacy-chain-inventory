// Transfers repository. SQL only.
// nextTransferNo runs inside the create transaction so a rolled-back transfer
// doesn't leave a gap in the from-branch's transfer counter.

import { pool } from '../db/pool.js';

const T_SELECT = `
  SELECT t.id, t.transfer_no, t.from_branch_id, t.to_branch_id, t.status, t.total_value,
         t.requested_by, t.approved_by, t.dispatched_by, t.received_by, t.shortage_note,
         t.created_at,
         bf.code AS from_branch_code, bf.name AS from_branch_name,
         bt.code AS to_branch_code, bt.name AS to_branch_name,
         ur.full_name AS requested_by_name,
         ua.full_name AS approved_by_name,
         ud.full_name AS dispatched_by_name,
         urc.full_name AS received_by_name
    FROM transfers t
    JOIN branches bf ON bf.id = t.from_branch_id
    JOIN branches bt ON bt.id = t.to_branch_id
    JOIN users ur ON ur.id = t.requested_by
    LEFT JOIN users ua  ON ua.id  = t.approved_by
    LEFT JOIN users ud  ON ud.id  = t.dispatched_by
    LEFT JOIN users urc ON urc.id = t.received_by
`;

export async function nextTransferNo(conn, fromBranchId) {
  const [counterRows] = await conn.query(
    'SELECT last_transfer_seq FROM branch_counters WHERE branch_id = ? FOR UPDATE',
    [fromBranchId]
  );
  if (!counterRows[0]) throw new Error(`No branch_counters row for branch ${fromBranchId}`);
  const newSeq = counterRows[0].last_transfer_seq + 1;
  await conn.execute('UPDATE branch_counters SET last_transfer_seq = ? WHERE branch_id = ?', [
    newSeq,
    fromBranchId,
  ]);
  const [branchRows] = await conn.execute('SELECT code FROM branches WHERE id = ?', [fromBranchId]);
  return `TR-${branchRows[0]?.code ?? 'XXX'}-${String(newSeq).padStart(5, '0')}`;
}

export async function findById(id) {
  const [rows] = await pool.execute(T_SELECT + ' WHERE t.id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function findByIdForUpdate(conn, id) {
  const [rows] = await conn.execute(
    `SELECT id, from_branch_id, to_branch_id, status, total_value
       FROM transfers WHERE id = ? FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

export async function findItemsByTransferId(transferId) {
  const [rows] = await pool.execute(
    `SELECT ti.id, ti.transfer_id, ti.medicine_id, ti.qty_requested, ti.qty_dispatched,
            ti.qty_received, ti.source_batch_id, ti.dest_batch_number, ti.dest_expiry_date,
            ti.unit_cost,
            m.generic_name, m.brand_name, m.form, m.strength, m.unit_label
       FROM transfer_items ti
       JOIN medicines m ON m.id = ti.medicine_id
      WHERE ti.transfer_id = ?
      ORDER BY ti.id`,
    [transferId]
  );
  return rows;
}

export async function findItemsForUpdate(conn, transferId) {
  const [rows] = await conn.execute(
    `SELECT id, transfer_id, medicine_id, qty_requested, qty_dispatched, qty_received,
            source_batch_id, dest_batch_number, dest_expiry_date, unit_cost
       FROM transfer_items
      WHERE transfer_id = ?
      ORDER BY id
      FOR UPDATE`,
    [transferId]
  );
  return rows;
}

export async function insertTransfer(conn, data) {
  const [res] = await conn.execute(
    `INSERT INTO transfers
       (transfer_no, from_branch_id, to_branch_id, status, total_value,
        requested_by, approved_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.transfer_no,
      data.from_branch_id,
      data.to_branch_id,
      data.status,
      data.total_value,
      data.requested_by,
      data.approved_by ?? null,
    ]
  );
  return res.insertId;
}

export async function insertItem(conn, data) {
  await conn.execute(
    `INSERT INTO transfer_items (transfer_id, medicine_id, qty_requested) VALUES (?, ?, ?)`,
    [data.transfer_id, data.medicine_id, data.qty_requested]
  );
}

export async function updateStatus(conn, id, status, opts = {}) {
  const sets = ['status = ?'];
  const params = [status];
  if (opts.approvedBy !== undefined) {
    sets.push('approved_by = ?');
    params.push(opts.approvedBy);
    sets.push('approved_at = IF(approved_at IS NULL, NOW(), approved_at)');
  }
  if (opts.dispatchedBy !== undefined) {
    sets.push('dispatched_by = ?');
    params.push(opts.dispatchedBy);
  }
  if (opts.receivedBy !== undefined) {
    sets.push('received_by = ?');
    params.push(opts.receivedBy);
  }
  if (opts.shortageNote !== undefined) {
    sets.push('shortage_note = ?');
    params.push(opts.shortageNote);
  }
  params.push(id);
  // transfers table does not have approved_at column — remove that line if it's a mistake
  const sql = `UPDATE transfers SET ${sets.filter((s) => !s.includes('approved_at')).join(', ')} WHERE id = ?`;
  await conn.execute(sql, params);
}

export async function updateItemOnDispatch(conn, itemId, d) {
  await conn.execute(
    `UPDATE transfer_items
        SET qty_dispatched = ?, source_batch_id = ?, dest_batch_number = ?,
            dest_expiry_date = ?, unit_cost = ?
      WHERE id = ?`,
    [
      d.qty_dispatched,
      d.source_batch_id,
      d.dest_batch_number,
      d.dest_expiry_date,
      d.unit_cost,
      itemId,
    ]
  );
}

export async function updateItemOnReceive(conn, itemId, { qty_received }) {
  await conn.execute('UPDATE transfer_items SET qty_received = ? WHERE id = ?', [
    qty_received,
    itemId,
  ]);
}

export async function list({ involvingBranchId, status, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (involvingBranchId) {
    where.push('(t.from_branch_id = ? OR t.to_branch_id = ?)');
    params.push(involvingBranchId, involvingBranchId);
  }
  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));
  const [rows] = await pool.query(
    `${T_SELECT} ${whereSql} ORDER BY t.created_at DESC, t.id DESC LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}
