// app.js builds the Express app and exports it. server.js owns the listen() so
// supertest can import `app` directly in tests without starting a real socket.

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import medicinesRoutes from './routes/medicines.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import purchaseOrdersRoutes from './routes/purchase_orders.routes.js';
import branchesRoutes from './routes/branches.routes.js';
import batchesRoutes from './routes/batches.routes.js';
import posRoutes from './routes/pos.routes.js';
import returnsRoutes from './routes/returns.routes.js';
import transfersRoutes from './routes/transfers.routes.js';
import reorderRoutes from './routes/reorder.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import stockCountsRoutes from './routes/stock_counts.routes.js';

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
// CORS: in development we accept any localhost origin (so Vite auto-picking
// 5174 when 5173 is busy doesn't break the app). In production we lock down
// to the exact origin configured in CORS_ORIGIN.
app.use(
  cors({
    origin:
      env.NODE_ENV === 'production'
        ? env.CORS_ORIGIN
        : (origin, cb) => {
            if (!origin) return cb(null, true);
            if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
              return cb(null, true);
            }
            if (origin === env.CORS_ORIGIN) return cb(null, true);
            return cb(new Error(`CORS: origin ${origin} not allowed`));
          },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// Global rate limiter — skipped during tests so a burst of supertest requests doesn't trip it.
if (env.NODE_ENV !== 'test') {
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    })
  );
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pharmacy-chain-inventory',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/batches', batchesRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/reorder-suggestions', reorderRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/stock-counts', stockCountsRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

// Error handler (last). Express 5 forwards thrown async errors here automatically.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) logger.error({ err }, 'Unhandled error');
  res.status(status).json({
    error: err.code || 'INTERNAL_ERROR',
    message: err.message,
    ...(err.meta ? { details: err.meta } : {}),
  });
});

export default app;
