// Payment adapter. One interface; one implementation ("mock") for the whole
// competition build — swapping in EVC Plus / Zaad / eDahab later means a new
// module that exports the same `charge({amount, method})` contract.
//
// Returning status: 'ok' | 'failed' keeps the POS service agnostic to which
// provider was used. A real adapter would make a network call here; the mock
// is deterministic so tests can assert on it.

import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export async function charge({ amount, method }) {
  if (env.PAYMENT_DRIVER !== 'mock') {
    throw new Error(`Unknown payment driver: ${env.PAYMENT_DRIVER}`);
  }
  // Tiny deterministic delay — mirrors what a real provider would take.
  await new Promise((r) => setTimeout(r, 5));
  const reference = `MOCK-${method}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  logger.debug({ amount, method, reference }, 'mock payment charged');
  return { status: 'ok', reference, method };
}
