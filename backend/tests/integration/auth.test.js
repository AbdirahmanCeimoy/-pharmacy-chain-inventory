import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

describe('POST /api/auth/login', () => {
  it('returns token + user on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@pharmacy.so', password: 'Owner@123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({
      email: 'owner@pharmacy.so',
      role: 'OWNER',
      branchId: null,
    });
    expect(res.body.user.fullName).toBeTruthy();
  });

  it('is case-insensitive on email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'OWNER@pharmacy.SO', password: 'Owner@123' });
    expect(res.status).toBe(200);
  });

  it('rejects wrong password with 401 (generic message, no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@pharmacy.so', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('rejects unknown email with 401 using the same message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@pharmacy.so', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('rejects malformed payload with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  let managerToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager.mog@pharmacy.so', password: 'Manager@123' });
    managerToken = res.body.token;
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  it('returns the current user on a valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      email: 'manager.mog@pharmacy.so',
      role: 'MANAGER',
    });
    expect(res.body.user.branchId).toBeTruthy();
  });
});

afterAll(async () => {
  await pool.end();
});
