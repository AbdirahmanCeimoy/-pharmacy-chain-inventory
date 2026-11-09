import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let ownerToken, mogManagerToken, pharmacistToken;
let supplierId, cheapMedId, secondMedId, mogBranchId;

function daysFromNowISO(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function createApprovedPo({ items, totalBelow1000 = true, notes }) {
  // Create as MOG manager, submit, (auto-approve if below 1000) else approve as owner.
  const create = await request(app)
    .post('/api/purchase-orders')
    .set('Authorization', `Bearer ${mogManagerToken}`)
    .send({ supplier_id: supplierId, notes, items });
  const po = create.body.purchaseOrder;
  const sub = await request(app)
    .post(`/api/purchase-orders/${po.id}/submit`)
    .set('Authorization', `Bearer ${mogManagerToken}`);
  let current = sub.body.purchaseOrder;
  if (current.status === 'SUBMITTED') {
    const appr = await request(app)
      .post(`/api/purchase-orders/${po.id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);
    current = appr.body.purchaseOrder;
  }
  expect(current.status).toBe('APPROVED');
  return current;
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
  pharmacistToken = p.body.token;

  const [branches] = await pool.query('SELECT id, code FROM branches WHERE code = ?', ['MOG-01']);
  mogBranchId = branches[0].id;
  const [suppliers] = await pool.query('SELECT id FROM suppliers ORDER BY id LIMIT 1');
  supplierId = suppliers[0].id;
  const [meds] = await pool.query(
    `SELECT id FROM medicines WHERE is_active = 1 AND is_controlled = 0
     ORDER BY selling_price ASC LIMIT 2`
  );
  cheapMedId = meds[0].id;
  secondMedId = meds[1].id;
});

afterAll(async () => {
  // Clean up: delete every artefact we might have created.
  // Batches (and their movements) carry TEST_ tags via po.notes — chase the chain.
  await pool.execute(
    `DELETE sm FROM stock_movements sm
      JOIN purchase_orders po ON po.id = sm.reference_id AND sm.reference_type = 'PO'
      WHERE po.notes LIKE 'TEST\\_%' ESCAPE '\\\\'`
  );
  await pool.execute(
    `DELETE b FROM batches b
      WHERE b.batch_number LIKE 'TESTB_%'`
  );
  await pool.execute(
    `DELETE poi FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchase_order_id
      WHERE po.notes LIKE 'TEST\\_%' ESCAPE '\\\\'`
  );
  await pool.execute(`DELETE FROM purchase_orders WHERE notes LIKE 'TEST\\_%' ESCAPE '\\\\'`);
  await pool.end();
});

describe('POST /api/purchase-orders/:id/receive', () => {
  it('pharmacist cannot receive (403)', async () => {
    const po = await createApprovedPo({
      items: [{ medicine_id: cheapMedId, qty_ordered: 10, expected_unit_cost: 2 }],
      notes: 'TEST_recv_pharm_reject',
    });
    const res = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 10,
            batch_number: 'TESTB_01',
            expiry_date: daysFromNowISO(180),
            actual_unit_cost: 2,
          },
        ],
      });
    expect(res.status).toBe(403);
  });

  it('rejects qty > 110% of ordered (409)', async () => {
    const po = await createApprovedPo({
      items: [{ medicine_id: cheapMedId, qty_ordered: 100, expected_unit_cost: 2 }],
      notes: 'TEST_recv_110_cap',
    });
    const res = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 115, // > 110
            batch_number: 'TESTB_cap',
            expiry_date: daysFromNowISO(180),
            actual_unit_cost: 2,
          },
        ],
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
  });

  it('accepts exactly 110% (edge of cap)', async () => {
    const po = await createApprovedPo({
      items: [{ medicine_id: cheapMedId, qty_ordered: 100, expected_unit_cost: 2 }],
      notes: 'TEST_recv_exact_110',
    });
    const res = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 110,
            batch_number: 'TESTB_exact_110',
            expiry_date: daysFromNowISO(180),
            actual_unit_cost: 2,
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.items[0].qtyReceived).toBe(110);
  });

  it('rejects expiry < 3 months when allow_short_expiry is not set (409)', async () => {
    const po = await createApprovedPo({
      items: [{ medicine_id: cheapMedId, qty_ordered: 10, expected_unit_cost: 2 }],
      notes: 'TEST_recv_short_expiry',
    });
    const res = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 10,
            batch_number: 'TESTB_short',
            expiry_date: daysFromNowISO(45), // under 90-day rule
            actual_unit_cost: 2,
          },
        ],
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/3-month rule/);
  });

  it('accepts expiry < 3 months when allow_short_expiry=true', async () => {
    const po = await createApprovedPo({
      items: [{ medicine_id: cheapMedId, qty_ordered: 10, expected_unit_cost: 2 }],
      notes: 'TEST_recv_short_allowed',
    });
    const res = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        allow_short_expiry: true,
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 10,
            batch_number: 'TESTB_short_allowed',
            expiry_date: daysFromNowISO(45),
            actual_unit_cost: 2,
          },
        ],
      });
    expect(res.status).toBe(200);
  });

  it('MERGES same batch_number into existing batch (qty adds, unit_cost unchanged)', async () => {
    const po = await createApprovedPo({
      items: [{ medicine_id: cheapMedId, qty_ordered: 50, expected_unit_cost: 2 }],
      notes: 'TEST_recv_merge',
    });
    const r1 = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 20,
            batch_number: 'TESTB_MERGE',
            expiry_date: daysFromNowISO(200),
            actual_unit_cost: 2.5, // original cost
          },
        ],
      });
    expect(r1.status).toBe(200);
    const r2 = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 15,
            batch_number: 'TESTB_MERGE',
            expiry_date: daysFromNowISO(200),
            actual_unit_cost: 9.99, // different cost — must be ignored (merge rule)
          },
        ],
      });
    expect(r2.status).toBe(200);
    const [rows] = await pool.query(
      `SELECT qty_on_hand, unit_cost FROM batches
        WHERE medicine_id = ? AND branch_id = ? AND batch_number = ?`,
      [cheapMedId, mogBranchId, 'TESTB_MERGE']
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].qty_on_hand)).toBe(35);
    expect(Number(rows[0].unit_cost)).toBe(2.5);
  });

  it('writes a RECEIVE stock_movement row per receive line (the audit-trail rule)', async () => {
    const po = await createApprovedPo({
      items: [{ medicine_id: cheapMedId, qty_ordered: 20, expected_unit_cost: 2 }],
      notes: 'TEST_recv_movement_audit',
    });
    const before = await pool.query(
      `SELECT COUNT(*) AS n FROM stock_movements
        WHERE reference_type = 'PO' AND reference_id = ?`,
      [po.id]
    );
    const beforeN = Number(before[0][0].n);
    const r = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 20,
            batch_number: 'TESTB_mov1',
            expiry_date: daysFromNowISO(180),
            actual_unit_cost: 2,
          },
        ],
      });
    expect(r.status).toBe(200);
    const after = await pool.query(
      `SELECT movement_type, qty_delta FROM stock_movements
        WHERE reference_type = 'PO' AND reference_id = ?`,
      [po.id]
    );
    expect(after[0]).toHaveLength(beforeN + 1);
    const latest = after[0].at(-1);
    expect(latest.movement_type).toBe('RECEIVE');
    expect(Number(latest.qty_delta)).toBe(20);
  });

  it('full receive transitions PO to RECEIVED', async () => {
    const po = await createApprovedPo({
      items: [{ medicine_id: cheapMedId, qty_ordered: 5, expected_unit_cost: 2 }],
      notes: 'TEST_recv_full',
    });
    const r = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 5,
            batch_number: 'TESTB_full',
            expiry_date: daysFromNowISO(200),
            actual_unit_cost: 2,
          },
        ],
      });
    expect(r.status).toBe(200);
    expect(r.body.purchaseOrder.status).toBe('RECEIVED');
  });

  it('partial receive transitions PO to PARTIALLY_RECEIVED', async () => {
    const po = await createApprovedPo({
      items: [
        { medicine_id: cheapMedId, qty_ordered: 10, expected_unit_cost: 2 },
        { medicine_id: secondMedId, qty_ordered: 10, expected_unit_cost: 3 },
      ],
      notes: 'TEST_recv_partial',
    });
    const r = await request(app)
      .post(`/api/purchase-orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${mogManagerToken}`)
      .send({
        items: [
          {
            po_item_id: po.items[0].id,
            qty: 10,
            batch_number: 'TESTB_partialA',
            expiry_date: daysFromNowISO(200),
            actual_unit_cost: 2,
          },
          // Deliberately not fulfilling items[1]
        ],
      });
    expect(r.status).toBe(200);
    expect(r.body.purchaseOrder.status).toBe('PARTIALLY_RECEIVED');
    const second = r.body.purchaseOrder.items.find((i) => i.medicineId === secondMedId);
    expect(Number(second.qtyReceived)).toBe(0);
  });
});
