import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let ownerToken, mogManagerToken, hgsManagerToken, mogBranchId, hgsBranchId;
let cheapMedId, premiumMedId;

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

async function ensureTestMedicine(name, price) {
  const [existing] = await pool.query('SELECT id FROM medicines WHERE generic_name = ?', [name]);
  if (existing.length) {
    await pool.execute('UPDATE medicines SET is_active = 1, selling_price = ? WHERE id = ?', [
      price,
      existing[0].id,
    ]);
    return existing[0].id;
  }
  const [res] = await pool.execute(
    `INSERT INTO medicines (generic_name, brand_name, form, strength, unit_label, selling_price)
     VALUES (?, 'TestBrand', 'TABLET', '100 mg', 'Box', ?)`,
    [name, price]
  );
  return res.insertId;
}

beforeAll(async () => {
  const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
  const [o, m, h] = await Promise.all([
    login('owner@pharmacy.so', 'Owner@123'),
    login('manager.mog@pharmacy.so', 'Manager@123'),
    login('manager.hgs@pharmacy.so', 'Manager@123'),
  ]);
  ownerToken = o.body.token;
  mogManagerToken = m.body.token;
  hgsManagerToken = h.body.token;
  const [branches] = await pool.query('SELECT id, code FROM branches');
  mogBranchId = branches.find((b) => b.code === 'MOG-01').id;
  hgsBranchId = branches.find((b) => b.code === 'HGS-01').id;
  cheapMedId = await ensureTestMedicine('TESTTR_Cheap', 2.0);
  premiumMedId = await ensureTestMedicine('TESTTR_Premium', 50.0);
});

afterAll(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const medId of [cheapMedId, premiumMedId]) {
      await conn.execute('DELETE FROM stock_movements WHERE medicine_id = ?', [medId]);
      await conn.execute('DELETE FROM transfer_items WHERE medicine_id = ?', [medId]);
      await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [medId]);
      await conn.execute('DELETE FROM medicines WHERE id = ?', [medId]);
    }
    await conn.execute(
      `DELETE t FROM transfers t LEFT JOIN transfer_items ti ON ti.transfer_id = t.id
        WHERE ti.id IS NULL AND t.created_at > NOW() - INTERVAL 1 HOUR`
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
    for (const medId of [cheapMedId, premiumMedId]) {
      await conn.execute('DELETE FROM batches WHERE medicine_id = ?', [medId]);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
});

describe('Transfers', () => {
  it('a manager can only request transfers INTO their own branch (403 otherwise)', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        from_branch_id: hgsBranchId,
        to_branch_id: hgsBranchId === mogBranchId ? mogBranchId : hgsBranchId, // same → will fail; set to not-own
      });
    // Use a properly scoped test instead:
    const res2 = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        from_branch_id: mogBranchId,
        to_branch_id: hgsBranchId, // MOG manager requesting INTO HGS — reject
        items: [{ medicine_id: cheapMedId, qty_requested: 1 }],
      });
    expect(res2.status).toBe(403);
  });

  it('total <= $500 auto-APPROVES on create; >$500 stays REQUESTED', async () => {
    // Small: 10 × $2 = $20 ≤ 500 → APPROVED
    const small = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${hgsManagerToken}`)
      .send({
        from_branch_id: mogBranchId,
        to_branch_id: hgsBranchId,
        items: [{ medicine_id: cheapMedId, qty_requested: 10 }],
      });
    expect(small.status).toBe(201);
    expect(small.body.transfer.status).toBe('APPROVED');

    // Big: 20 × $50 = $1000 > 500 → REQUESTED
    const big = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${hgsManagerToken}`)
      .send({
        from_branch_id: mogBranchId,
        to_branch_id: hgsBranchId,
        items: [{ medicine_id: premiumMedId, qty_requested: 20 }],
      });
    expect(big.status).toBe(201);
    expect(big.body.transfer.status).toBe('REQUESTED');

    // Manager cannot approve.
    const notOwner = await request(app)
      .post(`/api/transfers/${big.body.transfer.id}/approve`)
      .set('Authorization', `Bearer ${hgsManagerToken}`);
    expect(notOwner.status).toBe(403);

    // OWNER approves.
    const approved = await request(app)
      .post(`/api/transfers/${big.body.transfer.id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(approved.status).toBe(200);
    expect(approved.body.transfer.status).toBe('APPROVED');
  });

  it('full cycle: in-transit is not sellable; on receive the batch is merged at destination', async () => {
    // Set up 100 units of cheapMed at MOG (sender).
    const mogBatch = await insertBatch({
      medicineId: cheapMedId,
      branchId: mogBranchId,
      batchNumber: 'TRTR_LOT1',
      qty: 100,
      unitCost: 1.5,
      daysToExpiry: 300,
    });

    // HGS manager requests 40 units from MOG → auto-approved (40 × $2 = $80).
    const create = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${hgsManagerToken}`)
      .send({
        from_branch_id: mogBranchId,
        to_branch_id: hgsBranchId,
        items: [{ medicine_id: cheapMedId, qty_requested: 40 }],
      });
    expect(create.status).toBe(201);
    const tid = create.body.transfer.id;
    const titemId = create.body.transfer.items[0].id;

    // MOG manager dispatches.
    const dispatched = await request(app)
      .post(`/api/transfers/${tid}/dispatch`)
      .set('Authorization', `Bearer ${mogManagerToken}`);
    expect(dispatched.status).toBe(200);
    expect(dispatched.body.transfer.status).toBe('DISPATCHED');
    expect(dispatched.body.transfer.items[0].destBatchNumber).toBe('TRTR_LOT1');

    // Sender batch decremented.
    const [[mogAfter]] = await pool.query('SELECT qty_on_hand FROM batches WHERE id = ?', [
      mogBatch,
    ]);
    expect(Number(mogAfter.qty_on_hand)).toBe(60);

    // At HGS there is NO batch yet with TRTR_LOT1 → stock in transit, not sellable anywhere.
    const [hgsBefore] = await pool.query(
      `SELECT id FROM batches WHERE medicine_id = ? AND branch_id = ? AND batch_number = 'TRTR_LOT1'`,
      [cheapMedId, hgsBranchId]
    );
    expect(hgsBefore).toHaveLength(0);

    // HGS manager receives all 40.
    const received = await request(app)
      .post(`/api/transfers/${tid}/receive`)
      .set('Authorization', `Bearer ${hgsManagerToken}`)
      .send({
        items: [{ transfer_item_id: titemId, qty_received: 40 }],
      });
    expect(received.status).toBe(200);
    expect(received.body.transfer.status).toBe('RECEIVED');

    // Batch now exists at HGS with same batch_number + expiry + unit_cost.
    const [[hgsBatch]] = await pool.query(
      `SELECT qty_on_hand, unit_cost, batch_number FROM batches
        WHERE medicine_id = ? AND branch_id = ? AND batch_number = 'TRTR_LOT1'`,
      [cheapMedId, hgsBranchId]
    );
    expect(Number(hgsBatch.qty_on_hand)).toBe(40);
    expect(Number(hgsBatch.unit_cost)).toBe(1.5);
  });

  it('partial receive records a shortage note', async () => {
    await insertBatch({
      medicineId: cheapMedId,
      branchId: mogBranchId,
      batchNumber: 'TRTR_SHORT',
      qty: 50,
    });
    const create = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${hgsManagerToken}`)
      .send({
        from_branch_id: mogBranchId,
        to_branch_id: hgsBranchId,
        items: [{ medicine_id: cheapMedId, qty_requested: 20 }],
      });
    const tid = create.body.transfer.id;
    const titemId = create.body.transfer.items[0].id;
    await request(app)
      .post(`/api/transfers/${tid}/dispatch`)
      .set('Authorization', `Bearer ${mogManagerToken}`);

    const rec = await request(app)
      .post(`/api/transfers/${tid}/receive`)
      .set('Authorization', `Bearer ${hgsManagerToken}`)
      .send({
        items: [{ transfer_item_id: titemId, qty_received: 15 }],
        shortage_note: 'Boxes damaged in transit',
      });
    expect(rec.status).toBe(200);
    expect(rec.body.transfer.status).toBe('RECEIVED');
    expect(rec.body.transfer.shortageNote).toMatch(/damaged/);
  });

  it('dispatch fails cleanly when no single batch has enough qty', async () => {
    await insertBatch({
      medicineId: cheapMedId,
      branchId: mogBranchId,
      batchNumber: 'TRTR_A',
      qty: 5,
    });
    await insertBatch({
      medicineId: cheapMedId,
      branchId: mogBranchId,
      batchNumber: 'TRTR_B',
      qty: 8,
    });
    const create = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${hgsManagerToken}`)
      .send({
        from_branch_id: mogBranchId,
        to_branch_id: hgsBranchId,
        items: [{ medicine_id: cheapMedId, qty_requested: 10 }],
      });
    const tid = create.body.transfer.id;
    const dispatched = await request(app)
      .post(`/api/transfers/${tid}/dispatch`)
      .set('Authorization', `Bearer ${mogManagerToken}`);
    expect(dispatched.status).toBe(409);
    expect(dispatched.body.message).toMatch(/single batch/);
  });

  it('non-sender cannot dispatch; non-receiver cannot receive', async () => {
    await insertBatch({
      medicineId: cheapMedId,
      branchId: mogBranchId,
      batchNumber: 'TRTR_RBAC',
      qty: 20,
    });
    const create = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${hgsManagerToken}`)
      .send({
        from_branch_id: mogBranchId,
        to_branch_id: hgsBranchId,
        items: [{ medicine_id: cheapMedId, qty_requested: 5 }],
      });
    const tid = create.body.transfer.id;
    // HGS manager tries to dispatch (should be 403; MOG manages dispatch).
    const bad = await request(app)
      .post(`/api/transfers/${tid}/dispatch`)
      .set('Authorization', `Bearer ${hgsManagerToken}`);
    expect(bad.status).toBe(403);

    // MOG manager dispatches, then MOG manager tries to receive (should be 403).
    await request(app)
      .post(`/api/transfers/${tid}/dispatch`)
      .set('Authorization', `Bearer ${mogManagerToken}`);
    const bad2 = await request(app)
      .post(`/api/transfers/${tid}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({ items: [{ transfer_item_id: create.body.transfer.items[0].id, qty_received: 5 }] });
    expect(bad2.status).toBe(403);
  });
});
