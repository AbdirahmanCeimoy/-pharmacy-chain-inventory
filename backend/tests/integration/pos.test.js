import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

// ----- test harness --------------------------------------------------------
// We create ONE dedicated test medicine (not in the seed) and manipulate its
// batches directly for each test. All test artefacts are prefixed TESTPOS_
// so cleanup is surgical and does not touch demo data.

let ownerToken, mogManagerToken, mogPharmacistToken;
let mogBranchId;
let testMedicineId; // normal medicine
let testControlledMedicineId; // controlled drug

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

async function getBatchQty(batchId) {
  const [rows] = await pool.execute('SELECT qty_on_hand FROM batches WHERE id = ?', [batchId]);
  return Number(rows[0].qty_on_hand);
}

// Reset must run on a single pinned connection — SET FOREIGN_KEY_CHECKS is
// session-scoped in InnoDB, and pool.execute() may pick a different connection
// each call. We leave CDR rows in place (they can't be deleted while the
// append-only triggers are in effect); their stale batch_id references are
// harmless once FK checks are turned back on because we don't re-insert into
// those batch ids. Full cleanup (including CDR) happens in afterAll by
// temporarily dropping the triggers.
async function resetBatchesForMedicine(medicineId) {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.execute(
      `DELETE sm FROM stock_movements sm
        JOIN batches b ON b.id = sm.batch_id
        WHERE b.medicine_id = ? AND b.batch_number LIKE 'TESTPOS_%'`,
      [medicineId]
    );
    await conn.execute(
      `DELETE sba FROM sale_batch_allocations sba
        JOIN batches b ON b.id = sba.batch_id
        WHERE b.medicine_id = ? AND b.batch_number LIKE 'TESTPOS_%'`,
      [medicineId]
    );
    await conn.execute(
      "DELETE FROM batches WHERE medicine_id = ? AND batch_number LIKE 'TESTPOS_%'",
      [medicineId]
    );
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
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

  // Idempotent: a previous failed run may have left these medicines behind.
  testMedicineId = await ensureTestMedicine({
    generic_name: 'TESTPOS_Normal',
    brand_name: 'TestBrand',
    strength: '100 mg',
    price: 10.0,
    controlled: false,
  });
  testControlledMedicineId = await ensureTestMedicine({
    generic_name: 'TESTPOS_Controlled',
    brand_name: 'TestOpioid',
    strength: '10 mg',
    price: 25.0,
    controlled: true,
  });
});

async function ensureTestMedicine({ generic_name, brand_name, strength, price, controlled }) {
  const [existing] = await pool.query(
    'SELECT id FROM medicines WHERE generic_name = ? AND brand_name = ? AND strength = ? AND form = ?',
    [generic_name, brand_name, strength, 'TABLET']
  );
  if (existing.length) {
    // Also ensure is_active = 1 in case a previous test deactivated it.
    await pool.execute('UPDATE medicines SET is_active = 1 WHERE id = ?', [existing[0].id]);
    return existing[0].id;
  }
  const [res] = await pool.execute(
    `INSERT INTO medicines
       (generic_name, brand_name, form, strength, unit_label, selling_price, is_controlled)
     VALUES (?, ?, 'TABLET', ?, 'Box of 10', ?, ?)`,
    [generic_name, brand_name, strength, price, controlled ? 1 : 0]
  );
  return res.insertId;
}

afterAll(async () => {
  const conn = await pool.getConnection();
  try {
    // Drop the append-only triggers so we can clean up CDR rows, then
    // put them back exactly as migration 007 defined them.
    await conn.query('DROP TRIGGER IF EXISTS trg_cdr_no_update');
    await conn.query('DROP TRIGGER IF EXISTS trg_cdr_no_delete');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const medId of [testMedicineId, testControlledMedicineId]) {
      await conn.execute('DELETE FROM stock_movements WHERE medicine_id = ?', [medId]);
      await conn.execute(
        'DELETE FROM sale_batch_allocations WHERE sale_item_id IN (SELECT id FROM sale_items WHERE medicine_id = ?)',
        [medId]
      );
      await conn.execute('DELETE FROM controlled_drug_register WHERE medicine_id = ?', [medId]);
      await conn.execute('DELETE FROM sale_items WHERE medicine_id = ?', [medId]);
      await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [medId]);
      await conn.execute('DELETE FROM medicines WHERE id = ?', [medId]);
    }
    // Sales rows left without items (all items were test items) — remove them.
    await conn.execute(
      `DELETE s FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE si.id IS NULL
          AND s.created_at > NOW() - INTERVAL 1 HOUR`
    );
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.query(
      `CREATE TRIGGER trg_cdr_no_update
       BEFORE UPDATE ON controlled_drug_register
       FOR EACH ROW
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'controlled_drug_register is append-only'`
    );
    await conn.query(
      `CREATE TRIGGER trg_cdr_no_delete
       BEFORE DELETE ON controlled_drug_register
       FOR EACH ROW
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'controlled_drug_register is append-only'`
    );
  } finally {
    conn.release();
    await pool.end();
  }
});

beforeEach(async () => {
  await resetBatchesForMedicine(testMedicineId);
  await resetBatchesForMedicine(testControlledMedicineId);
});

// ----- FEFO ----------------------------------------------------------------

describe('FEFO: earliest-expiry deduction', () => {
  it('single-batch sale deducts from the EARLIEST-expiring batch, not the latest', async () => {
    const far = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_FAR',
      qty: 10,
      daysToExpiry: 365,
    });
    const soon = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_SOON',
      qty: 10,
      daysToExpiry: 30,
    });
    const mid = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_MID',
      qty: 10,
      daysToExpiry: 120,
    });

    const res = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 3 }],
      });

    expect(res.status).toBe(201);
    expect(await getBatchQty(soon)).toBe(7); // ← the oldest-expiring batch lost 3
    expect(await getBatchQty(mid)).toBe(10);
    expect(await getBatchQty(far)).toBe(10);
  });

  it('multi-batch sale walks from oldest expiry to next', async () => {
    const soon = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_SOON',
      qty: 5,
      daysToExpiry: 30,
    });
    const later = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_LATER',
      qty: 10,
      daysToExpiry: 200,
    });

    const res = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 8 }],
      });

    expect(res.status).toBe(201);
    expect(await getBatchQty(soon)).toBe(0); // took all 5
    expect(await getBatchQty(later)).toBe(7); // then took 3 more
    // Sale allocations reflect the split.
    expect(res.body.sale.items[0].allocations).toHaveLength(2);
  });

  it('expired batches are never sold (returns 409 OUT_OF_STOCK)', async () => {
    const expired = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_EXP',
      qty: 100,
      daysToExpiry: -1,
    });
    const good = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_GOOD',
      qty: 5,
      daysToExpiry: 180,
    });

    const res = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 10 }], // only 5 usable
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
    // Neither batch moved.
    expect(await getBatchQty(expired)).toBe(100);
    expect(await getBatchQty(good)).toBe(5);
  });
});

// ----- Overdraw + audit trail ----------------------------------------------

describe('Overdraw + stock movements', () => {
  it('overdraw is rejected with 409 and batch qty is unchanged', async () => {
    const b = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_OVER',
      qty: 5,
      daysToExpiry: 180,
    });
    const res = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 10 }],
      });
    expect(res.status).toBe(409);
    expect(await getBatchQty(b)).toBe(5);
  });

  it('writes exactly one SALE stock_movement per batch tapped', async () => {
    const soon = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_SOON',
      qty: 5,
      daysToExpiry: 30,
    });
    const later = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_LATER',
      qty: 10,
      daysToExpiry: 200,
    });

    const res = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testMedicineId, qty: 8 }],
      });
    expect(res.status).toBe(201);

    const [movs] = await pool.query(
      `SELECT batch_id, qty_delta, movement_type
         FROM stock_movements
        WHERE reference_type = 'SALE' AND reference_id = ?
        ORDER BY id`,
      [res.body.sale.id]
    );
    expect(movs).toHaveLength(2); // one per batch tapped
    expect(movs.every((m) => m.movement_type === 'SALE')).toBe(true);
    const byBatch = Object.fromEntries(movs.map((m) => [m.batch_id, Number(m.qty_delta)]));
    expect(byBatch[soon]).toBe(-5);
    expect(byBatch[later]).toBe(-3);
  });
});

// ----- CONCURRENCY (the headline test) -------------------------------------

describe('CORE: concurrency on the last unit', () => {
  it('two cashiers sell the last unit at once — exactly one succeeds, stock never negative', async () => {
    const b = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_LAST',
      qty: 1,
      daysToExpiry: 180,
    });

    const send = () =>
      request(app)
        .post('/api/pos/sales')
        .set('Authorization', `Bearer ${mogPharmacistToken}`)
        .send({
          payment_method: 'CASH',
          items: [{ medicine_id: testMedicineId, qty: 1 }],
        });

    const [r1, r2] = await Promise.all([send(), send()]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
    const qty = await getBatchQty(b);
    expect(qty).toBe(0);
    expect(qty).toBeGreaterThanOrEqual(0); // DB CHECK + app guard
  });

  it('stock never goes negative under load (20 parallel sales for 10 units)', async () => {
    const b = await insertBatch({
      medicineId: testMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_RACE',
      qty: 10,
      daysToExpiry: 180,
    });

    const send = () =>
      request(app)
        .post('/api/pos/sales')
        .set('Authorization', `Bearer ${mogPharmacistToken}`)
        .send({
          payment_method: 'CASH',
          items: [{ medicine_id: testMedicineId, qty: 1 }],
        });

    const results = await Promise.all(Array.from({ length: 20 }, () => send()));
    const ok = results.filter((r) => r.status === 201).length;
    const conflict = results.filter((r) => r.status === 409).length;
    expect(ok).toBe(10);
    expect(conflict).toBe(10);
    expect(await getBatchQty(b)).toBe(0);
  });
});

// ----- Controlled drug ------------------------------------------------------

describe('Controlled drugs', () => {
  it('a non-pharmacist cannot sell a controlled drug (403)', async () => {
    await insertBatch({
      medicineId: testControlledMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_CTRL',
      qty: 5,
      daysToExpiry: 180,
      unitCost: 15,
    });
    const res = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        payment_method: 'CASH',
        items: [
          {
            medicine_id: testControlledMedicineId,
            qty: 1,
            prescription: {
              prescription_number: 'RX-TEST-001',
              doctor_name: 'Dr. Test',
              patient_name: 'Test Patient',
            },
          },
        ],
      });
    expect(res.status).toBe(403);
  });

  it('a pharmacist without prescription fields gets 400', async () => {
    await insertBatch({
      medicineId: testControlledMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_CTRL',
      qty: 5,
      daysToExpiry: 180,
      unitCost: 15,
    });
    const res = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [{ medicine_id: testControlledMedicineId, qty: 1 }],
      });
    expect(res.status).toBe(400);
  });

  it('a pharmacist with prescription writes a controlled_drug_register row with running_balance', async () => {
    await insertBatch({
      medicineId: testControlledMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_CTRL',
      qty: 5,
      daysToExpiry: 180,
      unitCost: 15,
    });
    const res = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [
          {
            medicine_id: testControlledMedicineId,
            qty: 2,
            prescription: {
              prescription_number: 'RX-TEST-002',
              doctor_name: 'Dr. Yusuf',
              patient_name: 'Khadija A.',
            },
          },
        ],
      });
    expect(res.status).toBe(201);

    const [rows] = await pool.query(
      `SELECT prescription_number, doctor_name, patient_name, qty, running_balance
         FROM controlled_drug_register
        WHERE medicine_id = ?
        ORDER BY id DESC
        LIMIT 1`,
      [testControlledMedicineId]
    );
    expect(rows[0]).toMatchObject({
      prescription_number: 'RX-TEST-002',
      doctor_name: 'Dr. Yusuf',
      patient_name: 'Khadija A.',
    });
    expect(Number(rows[0].qty)).toBe(2);
    expect(Number(rows[0].running_balance)).toBe(3); // 5 - 2
  });

  it('controlled_drug_register is append-only (UPDATE blocked by trigger)', async () => {
    await insertBatch({
      medicineId: testControlledMedicineId,
      branchId: mogBranchId,
      batchNumber: 'TESTPOS_CTRL',
      qty: 5,
      daysToExpiry: 180,
      unitCost: 15,
    });
    const res = await request(app)
      .post('/api/pos/sales')
      .set('Authorization', `Bearer ${mogPharmacistToken}`)
      .send({
        payment_method: 'CASH',
        items: [
          {
            medicine_id: testControlledMedicineId,
            qty: 1,
            prescription: {
              prescription_number: 'RX-TEST-003',
              doctor_name: 'Dr. X',
              patient_name: 'Patient Y',
            },
          },
        ],
      });
    expect(res.status).toBe(201);

    const [[row]] = await pool.query(
      'SELECT id FROM controlled_drug_register WHERE medicine_id = ? ORDER BY id DESC LIMIT 1',
      [testControlledMedicineId]
    );

    await expect(
      pool.execute("UPDATE controlled_drug_register SET patient_name = 'Hacker' WHERE id = ?", [
        row.id,
      ])
    ).rejects.toThrow(/append-only/i);

    await expect(
      pool.execute('DELETE FROM controlled_drug_register WHERE id = ?', [row.id])
    ).rejects.toThrow(/append-only/i);
  });
});
