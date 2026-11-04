import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import * as resetService from '../services/password_resets.service.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import { env } from '../config/env.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new ValidationError('Invalid login payload', parsed.error.flatten().fieldErrors));
  }
  try {
    const result = await authService.login(parsed.data.email.toLowerCase(), parsed.data.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await authService.me(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// Per-IP rate limit for password-reset endpoints — bypassed in tests.
const resetLimiter =
  env.NODE_ENV === 'test'
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
      });

router.post('/forgot-password', resetLimiter, async (req, res, next) => {
  try {
    res.json(await resetService.requestReset(req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/verify-otp', resetLimiter, async (req, res, next) => {
  try {
    res.json(await resetService.verifyOtp(req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', resetLimiter, async (req, res, next) => {
  try {
    res.json(await resetService.resetPassword(req.body, req.ip));
  } catch (err) {
    next(err);
  }
});

export default router;
