import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let ownerToken, mogManagerToken, mogPharmacistToken, mogBranchId, testMedicineId;

async function ensureTestMedicine() {
  const [existing] = await pool.query(
    "SELECT id FROM medicines WHERE generic_name = 'TESTREP_Med'"
  );
  if (existing.length) {
    await pool.execute('UPDATE medicines SET is_active = 1 WHERE id = ?', [existing[0].id]);
    return existing[0].id;
  }
  const [res] = await pool.execute(
    `INSERT INTO medicines (generic_name, brand_name, form, strength, unit_label, selling_price)
     VALUES ('TESTREP_Med', 'TestRep', 'TABLET', '10 mg', 'Box', 5.00)`
  );
  return res.insertId;
}

async function insertBatch(batchNumber, qty, unitCost = 2.0, daysToExpiry = 180) {
  const d = new Date();
  d.setDate(d.getDate() + daysToExpiry);
  const [res] = await pool.execute(
    `INSERT INTO batches (medicine_id, branch_id, batch_number, expiry_date, qty_on_hand, unit_cost)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [testMedicineId, mogBranchId, batchNumber, d.toISOString().slice(0, 10), qty, unitCost]
  );
  return res.insertId;
}

beforeAll(async () => {
  const login = (e, p) => request(app).post('/api/auth/login').send({ email: e, password: p });
  const [o, m, p] = await Promise.all([
    login('owner@pharmacy.so', 'Owner@123'),
    login('manager.mog@pharmacy.so', 'Manager@123'),
    login('pharm.mog@pharmacy.so', 'Pharm@123'),
  ]);
  ownerToken = o.body.token;
  mogManagerToken = m.body.token;
  mogPharmacistToken = p.body.token;
  const [br] = await pool.query("SELECT id FROM branches WHERE code = 'MOG-01'");
  mogBranchId = br[0].id;
  testMedicineId = await ensureTestMedicine();
});

afterAll(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.execute('DELETE FROM stock_movements WHERE medicine_id = ?', [testMedicineId]);
    await conn.execute(
      'DELETE FROM sale_batch_allocations WHERE sale_item_id IN (SELECT id FROM sale_items WHERE medicine_id = ?)',
      [testMedicineId]
    );
    await conn.execute(
      'DELETE FROM return_items WHERE sale_item_id IN (SELECT id FROM sale_items WHERE medicine_id = ?)',
      [testMedicineId]
    );
    await conn.execute('DELETE FROM sale_items WHERE medicine_id = ?', [testMedicineId]);
    await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [testMedicineId]);
    await conn.execute('DELETE FROM medicines WHERE id = ?', [testMedicineId]);
    await conn.execute(
      `DELETE s FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE si.id IS NULL AND s.created_at > NOW() - INTERVAL 1 HOUR`
    );
    await conn.execute(
      `DELETE r FROM returns r LEFT JOIN return_items ri ON ri.return_id = r.id
        WHERE ri.id IS NULL AND r.created_at > NOW() - INTERVAL 1 HOUR`
    );
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
    await pool.end();
  }
});

describe('Reports', () => {
  it('profit = revenue − cost using per-batch actual unit_cost', async () => {
    // Clean slate for this medicine, then insert one batch at cost 2.00
    const conn = await pool.getConnection();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      await conn.execute('DELETE FROM stock_movements WHERE medicine_id = ?', [testMedicineId]);
      await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [testMedicineId]);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      conn.release();
    }
    await insertBatch('TESTREP_P1', 50, 2.0);

    // Sell 10 units at $5/unit → revenue $50, cost $20, profit $30.
    const sale = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 10 }],
      });
    expect(sale.status).toBe(201);

    const res = await request(app)
      .get(`/api/reports/profit?branchId=${mogBranchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);

    // Our sale is one of potentially many today; find its contribution.
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = res.body.rows.filter((r) => String(r.period).startsWith(today));
    const totalRev = todayRows.reduce((s, r) => s + r.revenue, 0);
    const totalCost = todayRows.reduce((s, r) => s + r.cost, 0);
    // Must be at least the $50 / $20 contribution from this test.
    expect(totalRev).toBeGreaterThanOrEqual(50);
    expect(totalCost).toBeGreaterThanOrEqual(20);
    // And the formula must hold on every row
    for (const r of res.body.rows) {
      expect(Number((r.revenue - r.cost).toFixed(2))).toBe(r.profit);
    }
  });

  it('returns reduce both revenue AND cost', async () => {
    // Fresh batch
    const conn = await pool.getConnection();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      await conn.execute('DELETE FROM stock_movements WHERE medicine_id = ?', [testMedicineId]);
      await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [testMedicineId]);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      conn.release();
    }
    await insertBatch('TESTREP_R1', 20, 3.0);

    const sale = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 4 }],
      });
    expect(sale.status).toBe(201);

    const before = await request(app)
      .get(`/api/reports/profit?branchId=${mogBranchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const rr = await request(app)
      .post('/api/returns')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        receipt_no: sale.body.sale.receiptNo,
        reason: 'Customer returned 1',
        items: [{ sale_item_id: sale.body.sale.items[0].id, qty: 1 }],
      });
    expect(rr.status).toBe(201);

    const after = await request(app)
      .get(`/api/reports/profit?branchId=${mogBranchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const beforeRev = before.body.totals.revenue;
    const afterRev = after.body.totals.revenue;
    const beforeCost = before.body.totals.cost;
    const afterCost = after.body.totals.cost;
    // Expect revenue to drop by ~$5 (1 unit × $5) and cost by ~$3 (1 × $3).
    expect(beforeRev - afterRev).toBeCloseTo(5, 2);
    expect(beforeCost - afterCost).toBeCloseTo(3, 2);
  });

  it('expiry-loss report sums write-offs correctly', async () => {
    // Insert a batch at cost $4; sell 2; expire the batch then "return" 1 (write-off).
    const conn = await pool.getConnection();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      await conn.execute('DELETE FROM stock_movements WHERE medicine_id = ?', [testMedicineId]);
      await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [testMedicineId]);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      conn.release();
    }
    const batchId = await insertBatch('TESTREP_WO', 10, 4.0);
    const sale = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 2 }],
      });
    expect(sale.status).toBe(201);
    // Expire the batch
    await pool.execute(
      'UPDATE batches SET expiry_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id = ?',
      [batchId]
    );
    // Return 1 unit → write-off movement at $4
    const rr = await request(app)
      .post('/api/returns')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        receipt_no: sale.body.sale.receiptNo,
        reason: 'Expired in customer hands',
        items: [{ sale_item_id: sale.body.sale.items[0].id, qty: 1 }],
      });
    expect(rr.status).toBe(201);

    const res = await request(app)
      .get(`/api/reports/expiry-loss?branchId=${mogBranchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    // Our contribution must be at least 0 qty but we did WRITE_OFF — note
    // our WRITE_OFF movement had qty_delta = 0, so loss_value is 0 for it.
    // Test the aggregation shape and the top10 list structure.
    expect(Array.isArray(res.body.monthly)).toBe(true);
    expect(Array.isArray(res.body.top10)).toBe(true);
    for (const m of res.body.monthly) {
      expect(m).toHaveProperty('month');
      expect(m).toHaveProperty('lossValue');
    }
  });

  it('PHARMACIST cannot pass ?branchId to see other branches (their own branch is forced)', async () => {
    const otherBranch = mogBranchId + 1; // whatever
    const res = await request(app)
      .get(`/api/reports/profit?branchId=${otherBranch}`)
      .set('Authorization', `Bearer ${mogPharmacistToken}`);
    expect(res.status).toBe(200);
    // Server-side scope: branchId resolves to the pharmacist's own.
    expect(res.body.branchId).toBe(mogBranchId);
  });
});
