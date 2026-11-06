import { pool } from '../src/db/pool.js';
const [rows] = await pool.query(
  "SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.tables WHERE TABLE_SCHEMA='pharmacy_chain' ORDER BY TABLE_NAME"
);
console.log(rows.length + ' tables in pharmacy_chain:');
console.table(rows);
await pool.end();
