import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let ownerToken, mogManagerToken, mogPharmacistToken, mogBranchId;
let testMedicineId, testControlledMedicineId;

function daysFromNowISO(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function insertBatch({
  medicineId,
  branchId,
  batchNumber,
  qty,
  unitCost = 1,
  daysToExpiry = 180,
}) {
  const [res] = await pool.execute(
    `INSERT INTO batches (medicine_id, branch_id, batch_number, expiry_date, qty_on_hand, unit_cost)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [medicineId, branchId, batchNumber, daysFromNowISO(daysToExpiry), qty, unitCost]
  );
  return res.insertId;
}

async function sellFor(medicineId, qty, extra = {}) {
  const res = await request(app)
    .post('/api/pos/sales')
    .set('Authorization', `Bearer ${mogPharmacistToken}`)
    .send({
      payment_method: 'CASH',
      items: [{ medicine_id: medicineId, qty, ...extra }],
    });
  return res.body.sale;
}

async function ensureTestMedicine(name, controlled) {
  const [existing] = await pool.query(`SELECT id FROM medicines WHERE generic_name = ?`, [name]);
  if (existing.length) {
    await pool.execute('UPDATE medicines SET is_active = 1 WHERE id = ?', [existing[0].id]);
    return existing[0].id;
  }
  const [res] = await pool.execute(
    `INSERT INTO medicines (generic_name, brand_name, form, strength, unit_label, selling_price, is_controlled)
     VALUES (?, 'TestRet', 'TABLET', '50 mg', 'Box', 4.00, ?)`,
    [name, controlled ? 1 : 0]
  );
  return res.insertId;
}

beforeAll(async () => {
  const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
  const [o, m, p] = await Promise.all([
    login('owner@pharmacy.so', 'Owner@123'),
    login('manager.mog@pharmacy.so', 'Manager@123'),
    login('pharm.mog@pharmacy.so', 'Pharm@123'),
  ]);
  ownerToken = o.body.token;
  mogManagerToken = m.body.token;
  mogPharmacistToken = p.body.token;
  const [branches] = await pool.query("SELECT id FROM branches WHERE code = 'MOG-01'");
  mogBranchId = branches[0].id;

  testMedicineId = await ensureTestMedicine('TESTRET_Normal', false);
  testControlledMedicineId = await ensureTestMedicine('TESTRET_Controlled', true);
});

afterAll(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query('DROP TRIGGER IF EXISTS trg_cdr_no_update');
    await conn.query('DROP TRIGGER IF EXISTS trg_cdr_no_delete');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const medId of [testMedicineId, testControlledMedicineId]) {
      await conn.execute('DELETE FROM stock_movements WHERE medicine_id = ?', [medId]);
      await conn.execute(
        'DELETE FROM sale_batch_allocations WHERE sale_item_id IN (SELECT id FROM sale_items WHERE medicine_id = ?)',
        [medId]
      );
      await conn.execute(
        'DELETE FROM return_items WHERE sale_item_id IN (SELECT id FROM sale_items WHERE medicine_id = ?)',
        [medId]
      );
      await conn.execute('DELETE FROM controlled_drug_register WHERE medicine_id = ?', [medId]);
      await conn.execute('DELETE FROM sale_items WHERE medicine_id = ?', [medId]);
      await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [medId]);
      await conn.execute('DELETE FROM medicines WHERE id = ?', [medId]);
    }
    await conn.execute(
      `DELETE r FROM returns r LEFT JOIN return_items ri ON ri.return_id = r.id
        WHERE ri.id IS NULL AND r.created_at > NOW() - INTERVAL 1 HOUR`
    );
    await conn.execute(
      `DELETE s FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE si.id IS NULL AND s.created_at > NOW() - INTERVAL 1 HOUR`
    );
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.query(
      `CREATE TRIGGER trg_cdr_no_update BEFORE UPDATE ON controlled_drug_register FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'controlled_drug_register is append-only'`
    );
    await conn.query(
      `CREATE TRIGGER trg_cdr_no_delete BEFORE DELETE ON controlled_drug_register FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'controlled_drug_register is append-only'`
    );
  } finally {
    conn.release();
    await pool.end();
  }
});

beforeEach(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const medId of [testMedicineId, testControlledMedicineId]) {
      await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [medId]);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
});

describe('Returns', () => {
  it('pharmacist cannot approve a return (403)', async () => {
    await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TR_B1',
      qty: 20,
    });
    const sale = await sellFor(testMedicineId, 3);
    const res = await request(app)
      .post('/api/returns')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        receipt_no: sale.receiptNo,
        reason: 'Customer changed mind',
        items: [{ sale_item_id: sale.items[0].id, qty: 1 }],
      });
    expect(res.status).toBe(403);
  });

  it('rejects after the 7-day window', async () => {
    await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TR_WIN',
      qty: 5,
    });
    const sale = await sellFor(testMedicineId, 2);
    // Backdate the sale 8 days.
    await pool.execute(
      'UPDATE sales SET created_at = DATE_SUB(NOW(), INTERVAL 8 DAY) WHERE id = ?',
      [sale.id]
    );
    const res = await request(app)
      .post('/api/returns')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        receipt_no: sale.receiptNo,
        reason: 'Too late',
        items: [{ sale_item_id: sale.items[0].id, qty: 1 }],
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/7-day|7 days/);
  });

  it('controlled drugs cannot be returned', async () => {
    await insertBatch({
      medicineId: testControlledMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TR_CTRL',
      qty: 5,
    });
    const sale = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [
          {
            medicine_id: testControlledMedicineId,
            qty: 1,
            prescription: {
              prescription_number: 'RX-RET',
              doctor_name: 'Dr. X',
              patient_name: 'Patient Y',
            },
          },
        ],
      });
    const res = await request(app)
      .post('/api/returns')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        receipt_no: sale.body.sale.receiptNo,
        reason: 'Trying to return controlled',
        items: [{ sale_item_id: sale.body.sale.items[0].id, qty: 1 }],
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/controlled/i);
  });

  it('happy path: restocks the batch and writes a RETURN movement', async () => {
    const batchId = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TR_HAPPY',
      qty: 10,
    });
    const sale = await sellFor(testMedicineId, 3); // batch now 7
    const res = await request(app)
      .post('/api/returns')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        receipt_no: sale.receiptNo,
        reason: 'Wrong strength',
        items: [{ sale_item_id: sale.items[0].id, qty: 2 }],
      });
    expect(res.status).toBe(201);
    expect(Number(res.body.return.refundAmount)).toBeCloseTo(
      2 * Number(sale.items[0].unitPrice),
      2
    );

    const [[batch]] = await pool.query('SELECT qty_on_hand FROM batches WHERE id = ?', [batchId]);
    expect(Number(batch.qty_on_hand)).toBe(9); // 7 + 2 back

    const [movs] = await pool.query(
      'SELECT movement_type, qty_delta FROM stock_movements WHERE batch_id = ? ORDER BY id DESC LIMIT 1',
      [batchId]
    );
    expect(movs[0].movement_type).toBe('RETURN');
    expect(Number(movs[0].qty_delta)).toBe(2);
  });

  it('expired batch: return is WRITE_OFF, no restock', async () => {
    const batchId = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TR_EXP',
      qty: 5,
      daysToExpiry: 30,
    });
    const sale = await sellFor(testMedicineId, 2); // batch now 3
    // Now simulate expiry by backdating the expiry_date.
    await pool.execute(
      'UPDATE batches SET expiry_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id = ?',
      [batchId]
    );
    const res = await request(app)
      .post('/api/returns')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        receipt_no: sale.receiptNo,
        reason: 'Found at home after expiry',
        items: [{ sale_item_id: sale.items[0].id, qty: 1 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.return.items[0].isWriteOff).toBe(true);

    // Qty on hand stays at 3 (no restock).
    const [[batch]] = await pool.query('SELECT qty_on_hand FROM batches WHERE id = ?', [batchId]);
    expect(Number(batch.qty_on_hand)).toBe(3);

    // A WRITE_OFF movement row exists.
    const [movs] = await pool.query(
      "SELECT movement_type FROM stock_movements WHERE batch_id = ? AND movement_type = 'WRITE_OFF'",
      [batchId]
    );
    expect(movs.length).toBeGreaterThan(0);
  });

  it('rejects returning more than the sale line qty (even across multiple return attempts)', async () => {
    await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TR_CAP',
      qty: 10,
    });
    const sale = await sellFor(testMedicineId, 2);
    // First return 1 of 2
    const r1 = await request(app)
      .post('/api/returns')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        receipt_no: sale.receiptNo,
        reason: 'first',
        items: [{ sale_item_id: sale.items[0].id, qty: 1 }],
      });
    expect(r1.status).toBe(201);
    // Try to return 2 more (would be 3 of 2 — reject)
    const r2 = await request(app)
      .post('/api/returns')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        receipt_no: sale.receiptNo,
        reason: 'over',
        items: [{ sale_item_id: sale.items[0].id, qty: 2 }],
      });
    expect(r2.status).toBe(409);
  });
});
