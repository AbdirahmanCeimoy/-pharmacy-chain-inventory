// Dev-only: drop and recreate the application database, then re-run migrate + seed.
// Never run against production. Exits early if NODE_ENV=production.

import mysql from 'mysql2/promise';
import { spawnSync } from 'node:child_process';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

async function main() {
  if (env.NODE_ENV === 'production') {
    logger.error('refusing to reset DB in production');
    process.exit(1);
  }

  const admin = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
  logger.warn(`dropping database ${env.DB_NAME} ...`);
  await admin.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);
  await admin.end();

  logger.info('re-running migrate + seed ...');
  const migrate = spawnSync('node', ['src/db/migrate.js'], { stdio: 'inherit' });
  if (migrate.status !== 0) process.exit(migrate.status || 1);
  const seed = spawnSync('node', ['src/db/seed.js'], { stdio: 'inherit' });
  if (seed.status !== 0) process.exit(seed.status || 1);
}

main().catch((err) => {
  logger.error({ err }, 'reset failed');
  process.exit(1);
});
