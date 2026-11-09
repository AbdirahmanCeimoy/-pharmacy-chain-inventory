import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let ownerToken, managerToken, pharmacistToken;

beforeAll(async () => {
  const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
  const [o, m, p] = await Promise.all([
    login('owner@pharmacy.so', 'Owner@123'),
    login('manager.mog@pharmacy.so', 'Manager@123'),
    login('pharm.mog@pharmacy.so', 'Pharm@123'),
  ]);
  ownerToken = o.body.token;
  managerToken = m.body.token;
  pharmacistToken = p.body.token;
});

afterAll(async () => {
  await pool.execute("DELETE FROM suppliers WHERE name LIKE 'TEST\\_%' ESCAPE '\\\\'");
  await pool.end();
});

describe('Suppliers', () => {
  it('lists suppliers for any authenticated user', async () => {
    const res = await request(app)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('paymentTerms');
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/suppliers');
    expect(res.status).toBe(401);
  });

  it('MANAGER cannot create a supplier (403)', async () => {
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'TEST_NoAccess' });
    expect(res.status).toBe(403);
  });

  it('PHARMACIST cannot create a supplier (403)', async () => {
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ name: 'TEST_NoAccess' });
    expect(res.status).toBe(403);
  });

  it('OWNER can create a supplier', async () => {
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `TEST_New_${Date.now()}`, phone: '+252-60-000-0000', payment_terms: 'NET 30' });
    expect(res.status).toBe(201);
    expect(res.body.supplier.isActive).toBe(true);
    expect(res.body.supplier.paymentTerms).toBe('NET 30');
  });
});
