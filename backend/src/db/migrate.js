// Migration runner: creates the database if missing, tracks applied files in
// schema_migrations, and applies each new .sql file in filename order.
// Idempotent: running twice is a no-op.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureDatabaseExists() {
  const admin = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(200) NOT NULL PRIMARY KEY,
      applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
}

async function appliedSet(conn) {
  const [rows] = await conn.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function main() {
  await ensureDatabaseExists();

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
  });

  try {
    await ensureMigrationsTable(conn);
    const applied = await appliedSet(conn);
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        logger.info(`skip  ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      logger.info(`apply ${file}`);
      await conn.query(sql);
      await conn.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      count++;
    }
    logger.info(`migrations done: ${count} applied, ${applied.size} already present.`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  logger.error({ err }, 'migrate failed');
  process.exit(1);
});
