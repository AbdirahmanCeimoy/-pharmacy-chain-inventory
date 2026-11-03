import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: false,
  timezone: 'Z',
});

// Run a function inside a MariaDB transaction. Retries on deadlock / lock-wait timeout
// with light jitter — the two codes we care about are what InnoDB throws when a
// concurrent sale lost the race for a batch row. This is the wrapper the POS service
// will call on Day 3.
export async function withTransaction(fn, options = {}) {
  const { maxRetries = 3, retryOn = ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'] } = options;
  let attempt = 0;
  while (true) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback().catch(() => {});
      if (retryOn.includes(err.code) && attempt < maxRetries) {
        attempt++;
        const jitter = 20 + Math.floor(Math.random() * 60);
        await new Promise((r) => setTimeout(r, jitter));
        continue;
      }
      throw err;
    } finally {
      conn.release();
    }
  }
}
