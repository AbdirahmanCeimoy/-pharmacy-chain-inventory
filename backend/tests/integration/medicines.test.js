import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let ownerToken, managerMogToken, managerHgsToken, pharmacistToken;

beforeAll(async () => {
  const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
  const [o, m, p, h] = await Promise.all([
    login('owner@pharmacy.so', 'Owner@123'),
    login('manager.mog@pharmacy.so', 'Manager@123'),
    login('pharm.mog@pharmacy.so', 'Pharm@123'),
    login('manager.hgs@pharmacy.so', 'Manager@123'),
  ]);
  ownerToken = o.body.token;
  managerMogToken = m.body.token;
  pharmacistToken = p.body.token;
  managerHgsToken = h.body.token;
});

afterAll(async () => {
  // Clean up any test medicines created with the TEST_ prefix.
  await pool.execute("DELETE FROM medicines WHERE generic_name LIKE 'TEST\\_%' ESCAPE '\\\\'");
  await pool.end();
});

describe('GET /api/medicines', () => {
  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/medicines');
    expect(res.status).toBe(401);
  });

  it('lists medicines for any authenticated user', async () => {
    const res = await request(app)
      .get('/api/medicines')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    // DTO shape (camelCase)
    expect(res.body.items[0]).toHaveProperty('genericName');
    expect(res.body.items[0]).toHaveProperty('sellingPrice');
    expect(res.body.items[0]).toHaveProperty('isControlled');
  });

  it('searches by generic name', async () => {
    const res = await request(app)
      .get('/api/medicines?q=Paracetamol')
      .set('Authorization', `Bearer ${managerMogToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(
      res.body.items.every(
        (m) =>
          m.genericName.toLowerCase().includes('paracetamol') ||
          m.brandName.toLowerCase().includes('paracetamol')
      )
    ).toBe(true);
  });
});

describe('Selling price is HQ-controlled — same across all branches', () => {
  it('two managers in different branches see the same selling_price for the same medicine', async () => {
    // Structural guarantee: selling_price is on the medicine row. No per-branch pricing table.
    const [mog, hgs] = await Promise.all([
      request(app)
        .get('/api/medicines?q=Amoxicillin')
        .set('Authorization', `Bearer ${managerMogToken}`),
      request(app)
        .get('/api/medicines?q=Amoxicillin')
        .set('Authorization', `Bearer ${managerHgsToken}`),
    ]);
    expect(mog.status).toBe(200);
    expect(hgs.status).toBe(200);
    const mogById = Object.fromEntries(mog.body.items.map((m) => [m.id, m.sellingPrice]));
    const hgsById = Object.fromEntries(hgs.body.items.map((m) => [m.id, m.sellingPrice]));
    for (const id of Object.keys(mogById)) {
      expect(hgsById[id]).toBe(mogById[id]);
    }
  });
});

describe('POST /api/medicines', () => {
  it('rejects when caller is a MANAGER (403)', async () => {
    const res = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${managerMogToken}`)
      .send({
        generic_name: `TEST_Manager_${Date.now()}`,
        brand_name: 'B',
        form: 'TABLET',
        strength: '100 mg',
        unit_label: 'Box of 10',
        selling_price: 1,
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('rejects when caller is a PHARMACIST (403)', async () => {
    const res = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        generic_name: `TEST_Pharm_${Date.now()}`,
        brand_name: 'B',
        form: 'TABLET',
        strength: '100 mg',
        unit_label: 'Box of 10',
        selling_price: 1,
      });
    expect(res.status).toBe(403);
  });

  it('owner can create a medicine', async () => {
    const payload = {
      generic_name: `TEST_Create_${Date.now()}`,
      brand_name: 'TestBrand',
      form: 'TABLET',
      strength: '100 mg',
      unit_label: 'Box of 10',
      selling_price: 2.5,
      is_controlled: false,
    };
    const res = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(payload);
    expect(res.status).toBe(201);
    expect(res.body.medicine).toMatchObject({
      genericName: payload.generic_name,
      isActive: true,
      isControlled: false,
    });
  });

  it('rejects duplicate identity with 409 CONFLICT', async () => {
    // Paracetamol / 500 mg / TABLET / Panadol is in the seed; retrying must 409.
    const res = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        generic_name: 'Paracetamol',
        brand_name: 'Panadol',
        form: 'TABLET',
        strength: '500 mg',
        unit_label: 'Box of 100',
        selling_price: 3.5,
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
  });

  it('rejects invalid payload with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ generic_name: '', form: 'MISC_FORM' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
