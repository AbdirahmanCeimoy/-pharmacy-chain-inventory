import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let ownerToken, mogManagerToken, hgsManagerToken, pharmacistToken;
let supplierId, cheapMedId, mogBranchId, hgsBranchId;

beforeAll(async () => {
  const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
  const [o, m, h, p] = await Promise.all([
    login('owner@pharmacy.so', 'Owner@123'),
    login('manager.mog@pharmacy.so', 'Manager@123'),
    login('manager.hgs@pharmacy.so', 'Manager@123'),
    login('pharm.mog@pharmacy.so', 'Pharm@123'),
  ]);
  ownerToken = o.body.token;
  mogManagerToken = m.body.token;
  hgsManagerToken = h.body.token;
  pharmacistToken = p.body.token;

  const [branches] = await pool.query('SELECT id, code FROM branches');
  mogBranchId = branches.find((b) => b.code === 'MOG-01').id;
  hgsBranchId = branches.find((b) => b.code === 'HGS-01').id;

  const [suppliers] = await pool.query('SELECT id FROM suppliers ORDER BY id LIMIT 1');
  supplierId = suppliers[0].id;

  const [meds] = await pool.query(
    'SELECT id FROM medicines WHERE is_active = 1 AND is_controlled = 0 ORDER BY selling_price ASC LIMIT 1'
  );
  cheapMedId = meds[0].id;
});

afterAll(async () => {
  // Clean up test POs (identified by TEST_ prefix in notes).
  await pool.execute(
    `DELETE FROM purchase_order_items
      WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE notes LIKE 'TEST\\_%' ESCAPE '\\\\')`
  );
  await pool.execute("DELETE FROM purchase_orders WHERE notes LIKE 'TEST\\_%' ESCAPE '\\\\'");
  // Also clean the audit rows we created for those POs.
  await pool.execute(
    "DELETE FROM audit_log WHERE entity_type = 'PO' AND user_id IN (SELECT id FROM users WHERE email LIKE '%@pharmacy.so') AND created_at > NOW() - INTERVAL 1 HOUR AND JSON_EXTRACT(meta_json, '$.total') IS NOT NULL"
  );
  await pool.end();
});

describe('POST /api/purchase-orders (RBAC + branch scoping)', () => {
  it('pharmacist cannot create a PO (403)', async () => {
    const res = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        supplier_id: supplierId,
        items: [{ medicine_id: cheapMedId, qty_ordered: 1, expected_unit_cost: 1 }],
        notes: 'TEST_pharm_reject',
      });
    expect(res.status).toBe(403);
  });

  it('manager cannot create a PO for another branch (403)', async () => {
    const res = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        branch_id: hgsBranchId,
        supplier_id: supplierId,
        items: [{ medicine_id: cheapMedId, qty_ordered: 1, expected_unit_cost: 1 }],
        notes: 'TEST_cross_branch',
      });
    expect(res.status).toBe(403);
  });

  it('manager creates a PO in their own branch with a generated PO number', async () => {
    const res = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        supplier_id: supplierId,
        items: [{ medicine_id: cheapMedId, qty_ordered: 5, expected_unit_cost: 2.0 }],
        notes: 'TEST_create_own_branch',
      });
    expect(res.status).toBe(201);
    expect(res.body.purchaseOrder.status).toBe('DRAFT');
    expect(res.body.purchaseOrder.poNumber).toMatch(/^PO-MOG-01-\d{5}$/);
    expect(res.body.purchaseOrder.branchId).toBe(mogBranchId);
    expect(res.body.purchaseOrder.totalAmount).toBe('10.00');
    expect(res.body.purchaseOrder.items).toHaveLength(1);
  });
});

describe('HQ approval threshold ($1000)', () => {
  let smallPoId, bigPoId;

  it('PO total <= $1000 auto-approves on submit (manager can do it)', async () => {
    const create = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        supplier_id: supplierId,
        items: [{ medicine_id: cheapMedId, qty_ordered: 100, expected_unit_cost: 2.0 }],
        notes: 'TEST_small_po',
      });
    expect(create.status).toBe(201);
    smallPoId = create.body.purchaseOrder.id;
    expect(Number(create.body.purchaseOrder.totalAmount)).toBeLessThanOrEqual(1000);

    const sub = await request(app)
      .post(`/api/purchase-orders/${smallPoId}/submit`)
      .set('Authorization', `Bearer ${mogManagerToken}`);
    expect(sub.status).toBe(200);
    expect(sub.body.purchaseOrder.status).toBe('APPROVED');
    expect(sub.body.purchaseOrder.approvedBy).toBeTruthy();
    expect(sub.body.purchaseOrder.approvedAt).toBeTruthy();
  });

  it('PO total > $1000 stays SUBMITTED until OWNER approves', async () => {
    const create = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        supplier_id: supplierId,
        items: [{ medicine_id: cheapMedId, qty_ordered: 1000, expected_unit_cost: 2.0 }],
        notes: 'TEST_big_po',
      });
    expect(create.status).toBe(201);
    bigPoId = create.body.purchaseOrder.id;
    expect(Number(create.body.purchaseOrder.totalAmount)).toBeGreaterThan(1000);

    const sub = await request(app)
      .post(`/api/purchase-orders/${bigPoId}/submit`)
      .set('Authorization', `Bearer ${mogManagerToken}`);
    expect(sub.status).toBe(200);
    expect(sub.body.purchaseOrder.status).toBe('SUBMITTED');
    expect(sub.body.purchaseOrder.approvedBy).toBeNull();
  });

  it('manager cannot approve the > $1000 PO (403)', async () => {
    const res = await request(app)
      .post(`/api/purchase-orders/${bigPoId}/approve`)
      .set('Authorization', `Bearer ${mogManagerToken}`);
    expect(res.status).toBe(403);
  });

  it('owner approves the > $1000 PO', async () => {
    const res = await request(app)
      .post(`/api/purchase-orders/${bigPoId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.status).toBe('APPROVED');
    expect(res.body.purchaseOrder.approvedBy).toBeTruthy();
  });

  it('cannot submit a PO that is already APPROVED (409)', async () => {
    const res = await request(app)
      .post(`/api/purchase-orders/${bigPoId}/submit`)
      .set('Authorization', `Bearer ${mogManagerToken}`);
    expect(res.status).toBe(409);
  });
});

describe('Branch scoping on GET /api/purchase-orders', () => {
  it('manager only sees their own branch', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .set('Authorization', `Bearer ${mogManagerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.every((po) => po.branchId === mogBranchId)).toBe(true);
  });

  it('HGS manager sees zero POs (none created yet in HGS)', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .set('Authorization', `Bearer ${hgsManagerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.every((po) => po.branchId === hgsBranchId)).toBe(true);
  });

  it('owner sees POs from the MOG branch too (all branches)', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.some((po) => po.branchId === mogBranchId)).toBe(true);
  });
});
