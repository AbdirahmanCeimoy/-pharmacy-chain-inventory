import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let ownerToken, mogManagerToken, mogPharmacistToken, pharmacistToken, mogBranchId;
let testMedicineId;

async function insertBatch({ batchNumber, qty, unitCost = 1, daysToExpiry = 180 }) {
  const d = new Date();
  d.setDate(d.getDate() + daysToExpiry);
  const [res] = await pool.execute(
    `INSERT INTO batches (medicine_id, branch_id, batch_number, expiry_date, qty_on_hand, unit_cost)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [testMedicineId, mogBranchId, batchNumber, d.toISOString().slice(0, 10), qty, unitCost]
  );
  return res.insertId;
}

async function ensureTestMedicine() {
  const [existing] = await pool.query(
    "SELECT id FROM medicines WHERE generic_name = 'TESTCNT_Med'"
  );
  if (existing.length) {
    await pool.execute('UPDATE medicines SET is_active = 1 WHERE id = ?', [existing[0].id]);
    return existing[0].id;
  }
  const [res] = await pool.execute(
    `INSERT INTO medicines (generic_name, brand_name, form, strength, unit_label, selling_price)
     VALUES ('TESTCNT_Med', 'TestCnt', 'TABLET', '10 mg', 'Box', 5.00)`
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
  pharmacistToken = mogPharmacistToken;
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
      'DELETE FROM stock_count_items WHERE batch_id IN (SELECT id FROM batches WHERE medicine_id = ?)',
      [testMedicineId]
    );
    await conn.execute(
      'DELETE FROM stock_counts WHERE branch_id = ? AND started_at > NOW() - INTERVAL 1 HOUR',
      [mogBranchId]
    );
    await conn.execute(
      'DELETE sba FROM sale_batch_allocations sba JOIN batches b ON b.id = sba.batch_id WHERE b.medicine_id = ?',
      [testMedicineId]
    );
    await conn.execute('DELETE FROM sale_items WHERE medicine_id = ?', [testMedicineId]);
    await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [testMedicineId]);
    await conn.execute('DELETE FROM medicines WHERE id = ?', [testMedicineId]);
    await conn.execute(
      `DELETE s FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE si.id IS NULL AND s.created_at > NOW() - INTERVAL 1 HOUR`
    );
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
    await pool.end();
  }
});

beforeEach(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.execute(
      'DELETE FROM stock_count_items WHERE batch_id IN (SELECT id FROM batches WHERE medicine_id = ?)',
      [testMedicineId]
    );
    await conn.execute("DELETE FROM stock_counts WHERE branch_id = ? AND status = 'IN_PROGRESS'", [
      mogBranchId,
    ]);
    await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [testMedicineId]);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
});

describe('Stock counts', () => {
  it('pharmacist cannot start (403)', async () => {
    await insertBatch({ batchNumber: 'SC_RBAC', qty: 10 });
    const res = await request(app)
      .post('/api/stock-counts')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('start snapshots batches and refuses a second concurrent count', async () => {
    await insertBatch({ batchNumber: 'SC_S1', qty: 10 });
    const start = await request(app)
      .post('/api/stock-counts')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({});
    expect(start.status).toBe(201);
    expect(start.body.stockCount.status).toBe('IN_PROGRESS');
    expect(start.body.stockCount.items.length).toBeGreaterThan(0);
    const snapshotItem = start.body.stockCount.items.find((i) => i.batchId);
    expect(snapshotItem.systemQty).toBeGreaterThan(0);

    // Second start fails.
    const dup = await request(app)
      .post('/api/stock-counts')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({});
    expect(dup.status).toBe(409);
  });

  it('POS is blocked for a medicine under an IN_PROGRESS count', async () => {
    const batchId = await insertBatch({ batchNumber: 'SC_BLOCK', qty: 20 });
    const start = await request(app)
      .post('/api/stock-counts')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({ medicine_ids: [testMedicineId] });
    expect(start.status).toBe(201);

    const sale = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 1 }],
      });
    expect(sale.status).toBe(409);
    expect(sale.body.message).toMatch(/stock count/i);

    // Batch untouched.
    const [[batch]] = await pool.query('SELECT qty_on_hand FROM batches WHERE id = ?', [batchId]);
    expect(Number(batch.qty_on_hand)).toBe(20);
  });

  it('submit applies adjustments and writes an ADJUST movement; reason required when non-zero', async () => {
    const batchId = await insertBatch({ batchNumber: 'SC_ADJ', qty: 50, unitCost: 2 });
    const start = await request(app)
      .post('/api/stock-counts')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({ medicine_ids: [testMedicineId] });
    const countId = start.body.stockCount.id;
    const item = start.body.stockCount.items.find((i) => i.batchId === batchId);

    // No reason on a non-zero adjustment → 400.
    const bad = await request(app)
      .post(`/api/stock-counts/${countId}/submit`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [{ stock_count_item_id: item.id, physical_qty: 47 }],
      });
    expect(bad.status).toBe(400);

    // With reason → 200.
    const ok = await request(app)
      .post(`/api/stock-counts/${countId}/submit`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [
          {
            stock_count_item_id: item.id,
            physical_qty: 47,
            reason: 'DAMAGED',
            note: '3 damaged in shelf 2',
          },
        ],
      });
    expect(ok.status).toBe(200);
    expect(ok.body.stockCount.status).toBe('COMPLETED');

    const [[batch]] = await pool.query('SELECT qty_on_hand FROM batches WHERE id = ?', [batchId]);
    expect(Number(batch.qty_on_hand)).toBe(47);

    const [movs] = await pool.query(
      "SELECT movement_type, qty_delta FROM stock_movements WHERE batch_id = ? AND movement_type = 'ADJUST'",
      [batchId]
    );
    expect(movs.length).toBe(1);
    expect(Number(movs[0].qty_delta)).toBe(-3);
  });

  it('cancel does not adjust stock', async () => {
    const batchId = await insertBatch({ batchNumber: 'SC_CAN', qty: 15 });
    const start = await request(app)
      .post('/api/stock-counts')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({ medicine_ids: [testMedicineId] });
    const cancel = await request(app)
      .post(`/api/stock-counts/${start.body.stockCount.id}/cancel`)
      .set('Authorization', `Bearer ${mogManagerToken}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.stockCount.status).toBe('CANCELLED');

    const [[batch]] = await pool.query('SELECT qty_on_hand FROM batches WHERE id = ?', [batchId]);
    expect(Number(batch.qty_on_hand)).toBe(15);
  });

  it('after submit/cancel the POS is unblocked again', async () => {
    await insertBatch({ batchNumber: 'SC_UNBLOCK', qty: 5 });
    const start = await request(app)
      .post('/api/stock-counts')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({ medicine_ids: [testMedicineId] });
    const item = start.body.stockCount.items[0];
    await request(app)
      .post(`/api/stock-counts/${start.body.stockCount.id}/submit`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [{ stock_count_item_id: item.id, physical_qty: item.systemQty }],
      });
    const sale = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 1 }],
      });
    expect(sale.status).toBe(201);
  });
});
