import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

// Helper: fetch the latest-issued OTP's hash and raw OTP by reading the
// password_resets row + the email_outbox body (the dev adapter writes the
// cleartext OTP in the email body).
async function latestOtpFromOutbox(email) {
  const [rows] = await pool.query(
    `SELECT body FROM email_outbox WHERE to_email = ? ORDER BY id DESC LIMIT 1`,
    [email]
  );
  if (!rows[0]) return null;
  const match = /verification code is:\s*(\d{6})/.exec(rows[0].body);
  return match ? match[1] : null;
}

beforeAll(async () => {
  // nothing — demo users exist from seed.
});

afterAll(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    // Clean our test artefacts (prs + outbox for the owner), and reset the
    // owner's password back to its seeded value so demo stays intact.
    await conn.execute(
      "DELETE FROM password_resets WHERE user_id = (SELECT id FROM users WHERE email = 'owner@pharmacy.so')"
    );
    await conn.execute("DELETE FROM email_outbox WHERE to_email = 'owner@pharmacy.so'");
    const hash = await bcrypt.hash('Owner@123', 10);
    await conn.execute("UPDATE users SET password_hash = ? WHERE email = 'owner@pharmacy.so'", [
      hash,
    ]);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
    await pool.end();
  }
});

beforeEach(async () => {
  await pool.execute(
    "DELETE FROM password_resets WHERE user_id = (SELECT id FROM users WHERE email = 'owner@pharmacy.so')"
  );
  await pool.execute("DELETE FROM email_outbox WHERE to_email = 'owner@pharmacy.so'");
});

describe('POST /api/auth/forgot-password', () => {
  it('returns a generic ack for an unknown email (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@nope.example' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it('rejects an invalid email format with 400', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('queues an email to the real user and does NOT return the OTP', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'owner@pharmacy.so' });
    expect(res.status).toBe(200);
    expect(res.body.otp).toBeUndefined();
    expect(res.body.resetToken).toBeUndefined();

    const otp = await latestOtpFromOutbox('owner@pharmacy.so');
    expect(otp).toMatch(/^\d{6}$/);
  });
});

describe('POST /api/auth/verify-otp', () => {
  it('rejects a wrong OTP and counts the attempt', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@pharmacy.so' });
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'owner@pharmacy.so', otp: '000000' });
    // Owner's real OTP is unlikely to be 000000; 1-in-million risk ignored.
    expect(res.status).toBe(401);
  });

  it('accepts the correct OTP and returns a reset token', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@pharmacy.so' });
    const otp = await latestOtpFromOutbox('owner@pharmacy.so');
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'owner@pharmacy.so', otp });
    expect(res.status).toBe(200);
    expect(res.body.resetToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('expired OTP is rejected', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@pharmacy.so' });
    // Backdate the OTP's expires_at to the past.
    await pool.execute(
      `UPDATE password_resets
          SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        WHERE user_id = (SELECT id FROM users WHERE email = 'owner@pharmacy.so')
          AND used = 0`
    );
    const otp = await latestOtpFromOutbox('owner@pharmacy.so');
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'owner@pharmacy.so', otp });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('too many wrong attempts locks the OTP', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@pharmacy.so' });
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'owner@pharmacy.so', otp: '111111' });
      expect([401, 409]).toContain(r.status);
    }
    // Even the real OTP is now locked out.
    const otp = await latestOtpFromOutbox('owner@pharmacy.so');
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'owner@pharmacy.so', otp });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/too many|expired/i);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('rejects a weak password', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@pharmacy.so' });
    const otp = await latestOtpFromOutbox('owner@pharmacy.so');
    const v = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'owner@pharmacy.so', otp });
    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'owner@pharmacy.so',
      resetToken: v.body.resetToken,
      newPassword: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('updates the password and lets the user log in with the new one', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@pharmacy.so' });
    const otp = await latestOtpFromOutbox('owner@pharmacy.so');
    const v = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'owner@pharmacy.so', otp });

    const newPw = 'NewSafe#9x';
    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'owner@pharmacy.so',
      resetToken: v.body.resetToken,
      newPassword: newPw,
    });
    expect(res.status).toBe(200);

    // Old password now fails.
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@pharmacy.so', password: 'Owner@123' });
    expect(bad.status).toBe(401);

    // New password works.
    const good = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@pharmacy.so', password: newPw });
    expect(good.status).toBe(200);
  });

  it('reset token is single-use', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@pharmacy.so' });
    const otp = await latestOtpFromOutbox('owner@pharmacy.so');
    const v = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'owner@pharmacy.so', otp });

    const r1 = await request(app).post('/api/auth/reset-password').send({
      email: 'owner@pharmacy.so',
      resetToken: v.body.resetToken,
      newPassword: 'FirstPass#99',
    });
    expect(r1.status).toBe(200);

    const r2 = await request(app).post('/api/auth/reset-password').send({
      email: 'owner@pharmacy.so',
      resetToken: v.body.resetToken,
      newPassword: 'SecondPass#99',
    });
    expect(r2.status).toBe(401);
  });
});
