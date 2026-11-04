// Sales repository — SQL only.
// nextReceiptNumber runs inside the sale transaction so a rolled-back sale
// rolls back the counter too (no gaps in receipt numbers).

import { pool } from '../db/pool.js';

export async function nextReceiptNumber(conn, branchId) {
  const [counterRows] = await conn.query(
    'SELECT last_receipt_seq FROM branch_counters WHERE branch_id = ? FOR UPDATE',
    [branchId]
  );
  if (!counterRows[0]) {
    throw new Error(`No branch_counters row for branch ${branchId}`);
  }
  const newSeq = counterRows[0].last_receipt_seq + 1;
  await conn.execute('UPDATE branch_counters SET last_receipt_seq = ? WHERE branch_id = ?', [
    newSeq,
    branchId,
  ]);
  const [branchRows] = await conn.execute('SELECT code FROM branches WHERE id = ?', [branchId]);
  const code = branchRows[0]?.code ?? 'XXX';
  return `${code}-${String(newSeq).padStart(6, '0')}`;
}

export async function insertSale(conn, data) {
  const [res] = await conn.execute(
    `INSERT INTO sales
       (receipt_no, branch_id, cashier_id, payment_method, subtotal, total)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.receipt_no,
      data.branch_id,
      data.cashier_id,
      data.payment_method,
      data.subtotal,
      data.total,
    ]
  );
  return res.insertId;
}

export async function insertSaleItem(conn, data) {
  const [res] = await conn.execute(
    `INSERT INTO sale_items (sale_id, medicine_id, qty, unit_price, line_total)
     VALUES (?, ?, ?, ?, ?)`,
    [data.sale_id, data.medicine_id, data.qty, data.unit_price, data.line_total]
  );
  return res.insertId;
}

export async function insertAllocation(conn, data) {
  await conn.execute(
    `INSERT INTO sale_batch_allocations (sale_item_id, batch_id, qty, unit_cost)
     VALUES (?, ?, ?, ?)`,
    [data.sale_item_id, data.batch_id, data.qty, data.unit_cost]
  );
}

const SALE_SELECT = `
  SELECT s.id, s.receipt_no, s.branch_id, s.cashier_id, s.payment_method,
         s.subtotal, s.total, s.status, s.created_at,
         b.code AS branch_code, b.name AS branch_name, b.phone AS branch_phone, b.address AS branch_address,
         u.full_name AS cashier_name
    FROM sales s
    JOIN branches b ON b.id = s.branch_id
    JOIN users u ON u.id = s.cashier_id
`;

export async function findById(id) {
  const [rows] = await pool.execute(SALE_SELECT + ' WHERE s.id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function findByReceipt(branchId, receiptNo) {
  const [rows] = await pool.execute(
    SALE_SELECT + ' WHERE s.branch_id = ? AND s.receipt_no = ? LIMIT 1',
    [branchId, receiptNo]
  );
  return rows[0] || null;
}

export async function findItemsBySaleId(saleId) {
  const [rows] = await pool.execute(
    `SELECT si.id, si.sale_id, si.medicine_id, si.qty, si.unit_price, si.line_total,
            m.generic_name, m.brand_name, m.form, m.strength, m.unit_label, m.is_controlled
       FROM sale_items si
       JOIN medicines m ON m.id = si.medicine_id
      WHERE si.sale_id = ?
      ORDER BY si.id`,
    [saleId]
  );
  return rows;
}

export async function findAllocationsBySaleId(saleId) {
  const [rows] = await pool.execute(
    `SELECT sba.id, sba.sale_item_id, sba.batch_id, sba.qty, sba.unit_cost,
            b.batch_number, b.expiry_date
       FROM sale_batch_allocations sba
       JOIN sale_items si ON si.id = sba.sale_item_id
       JOIN batches b ON b.id = sba.batch_id
      WHERE si.sale_id = ?
      ORDER BY sba.id`,
    [saleId]
  );
  return rows;
}

export async function list({ branchId, cashierId, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (branchId) {
    where.push('s.branch_id = ?');
    params.push(branchId);
  }
  if (cashierId) {
    where.push('s.cashier_id = ?');
    params.push(cashierId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));
  const [rows] = await pool.query(
    SALE_SELECT + ` ${whereSql} ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}
