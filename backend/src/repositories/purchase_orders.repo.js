// Purchase orders repository. SQL only.
// nextPoNumber() runs inside a caller-supplied transaction — the branch_counter
// row is locked with FOR UPDATE and the sequence bumps atomically. If the PO
// insert later fails and we rollback, the counter rolls back too, so no gaps.

import { pool } from '../db/pool.js';

const PO_SELECT = `
  SELECT po.id, po.po_number, po.branch_id, po.supplier_id, po.status, po.total_amount,
         po.created_by, po.approved_by, po.approved_at, po.notes, po.created_at, po.updated_at,
         s.name AS supplier_name,
         b.code AS branch_code, b.name AS branch_name,
         cu.full_name AS created_by_name,
         au.full_name AS approved_by_name
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    JOIN branches  b ON b.id = po.branch_id
    JOIN users    cu ON cu.id = po.created_by
    LEFT JOIN users au ON au.id = po.approved_by
`;

export async function findById(id) {
  const [rows] = await pool.execute(PO_SELECT + ' WHERE po.id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Minimal projection used when we only need to lock + read status for a state transition.
export async function findByIdForUpdate(conn, id) {
  const [rows] = await conn.execute(
    'SELECT id, branch_id, status, total_amount FROM purchase_orders WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0] || null;
}

export async function findItemsByPoId(poId) {
  const [rows] = await pool.execute(
    `SELECT poi.id, poi.purchase_order_id, poi.medicine_id, poi.qty_ordered,
            poi.qty_received, poi.expected_unit_cost,
            m.generic_name, m.brand_name, m.form, m.strength, m.unit_label
       FROM purchase_order_items poi
       JOIN medicines m ON m.id = poi.medicine_id
      WHERE poi.purchase_order_id = ?
      ORDER BY poi.id`,
    [poId]
  );
  return rows;
}

export async function list({ branchId, status, q, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (branchId) {
    where.push('po.branch_id = ?');
    params.push(branchId);
  }
  if (status) {
    where.push('po.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(po.po_number LIKE ? OR s.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));
  const [rows] = await pool.query(
    `${PO_SELECT} ${whereSql} ORDER BY po.created_at DESC, po.id DESC LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

export async function nextPoNumber(conn, branchId) {
  const [counterRows] = await conn.query(
    'SELECT last_po_seq FROM branch_counters WHERE branch_id = ? FOR UPDATE',
    [branchId]
  );
  if (!counterRows[0]) {
    throw new Error(`No branch_counters row for branch ${branchId}`);
  }
  const newSeq = counterRows[0].last_po_seq + 1;
  await conn.execute('UPDATE branch_counters SET last_po_seq = ? WHERE branch_id = ?', [
    newSeq,
    branchId,
  ]);
  const [branchRows] = await conn.execute('SELECT code FROM branches WHERE id = ?', [branchId]);
  const code = branchRows[0]?.code ?? 'XXX';
  return `PO-${code}-${String(newSeq).padStart(5, '0')}`;
}

export async function insertPO(conn, data) {
  const [res] = await conn.execute(
    `INSERT INTO purchase_orders
       (po_number, branch_id, supplier_id, status, total_amount, created_by, notes)
     VALUES (?, ?, ?, 'DRAFT', ?, ?, ?)`,
    [
      data.po_number,
      data.branch_id,
      data.supplier_id,
      data.total_amount,
      data.created_by,
      data.notes ?? null,
    ]
  );
  return res.insertId;
}

export async function insertItem(conn, poId, item) {
  await conn.execute(
    `INSERT INTO purchase_order_items
       (purchase_order_id, medicine_id, qty_ordered, expected_unit_cost)
     VALUES (?, ?, ?, ?)`,
    [poId, item.medicine_id, item.qty_ordered, item.expected_unit_cost]
  );
}

export async function updateStatus(conn, poId, status, { approvedBy } = {}) {
  if (approvedBy != null) {
    await conn.execute(
      'UPDATE purchase_orders SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
      [status, approvedBy, poId]
    );
  } else {
    await conn.execute('UPDATE purchase_orders SET status = ? WHERE id = ?', [status, poId]);
  }
}
