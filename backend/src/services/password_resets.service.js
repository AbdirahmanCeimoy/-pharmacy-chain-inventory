// Password-reset service.
//
//   requestReset(email):
//     - Always returns {status:'ok'} regardless of whether the email exists —
//       prevents user enumeration.
//     - Internally: if the account exists, rate-limit to 3 requests / 15 min,
//       invalidate prior OTPs, generate a cryptographically-random 6-digit OTP,
//       bcrypt-hash it, store with 5-minute expiry, queue a templated email.
//
//   verifyOtp(email, otp):
//     - Rejects after MAX_ATTEMPTS wrong tries (locks the OTP).
//     - Rejects expired OTPs.
//     - On success, generates a one-shot reset_token (32-byte hex), stores
//       its bcrypt hash with a 15-minute window, returns the plaintext.
//
//   resetPassword(email, resetToken, newPassword):
//     - Validates password strength (min 8 chars, letter + digit).
//     - Verifies the reset_token against the stored hash and expiry.
//     - Updates password_hash with a fresh bcrypt.
//     - Marks the reset_token used (one-shot).
//     - Returns {status:'ok'}.

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, withTransaction } from '../db/pool.js';
import * as usersRepo from '../repositories/users.repo.js';
import * as prRepo from '../repositories/password_resets.repo.js';
import * as auditRepo from '../repositories/audit.repo.js';
import { sendEmail } from '../adapters/email.adapter.js';
import { env } from '../config/env.js';
import { ValidationError, UnauthorizedError, ConflictError } from '../utils/errors.js';

const OTP_TTL_MINUTES = 5;
const RESET_TOKEN_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MINUTES = 15;
const RATE_MAX_REQUESTS = 3;

const requestSchema = z.object({
  email: z.string().trim().email().max(120),
});

const verifySchema = z.object({
  email: z.string().trim().email().max(120),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

// Password strength: 8+ chars, at least one letter and one digit.
export const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const resetSchema = z.object({
  email: z.string().trim().email().max(120),
  resetToken: z.string().trim().length(64),
  newPassword: strongPassword,
});

function genericAck() {
  return {
    status: 'ok',
    message: 'If an account exists for that email, a verification code has been sent.',
  };
}

async function hashBcrypt(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function requestReset(payload) {
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Please enter a valid email address.');
  }
  const email = parsed.data.email.toLowerCase();
  const user = await usersRepo.findActiveByEmail(email);
  if (!user) {
    return genericAck(); // never confirm non-existence
  }

  // Rate limit per-user: 3 requests in any 15-minute window.
  const recent = await prRepo.countRecentRequests(user.id, RATE_WINDOW_MINUTES);
  if (recent >= RATE_MAX_REQUESTS) {
    return genericAck(); // still generic to avoid leaking
  }

  // 6-digit OTP, cryptographically random.
  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const otpHash = await hashBcrypt(otp);

  await withTransaction(async (conn) => {
    await prRepo.invalidateActiveForUser(conn, user.id);
    await prRepo.insertOtp(conn, {
      userId: user.id,
      otpHash,
      ttlMinutes: OTP_TTL_MINUTES,
    });
  });

  await sendEmail({
    to: user.email,
    subject: 'Your PharmaTrack password reset code',
    body:
      `Hi ${user.full_name},\n\n` +
      `Your PharmaTrack verification code is: ${otp}\n\n` +
      `This code expires in ${OTP_TTL_MINUTES} minutes.\n` +
      `If you did not request this, you can safely ignore this email.\n`,
  });

  return genericAck();
}

export async function verifyOtp(payload) {
  const parsed = verifySchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Please enter the 6-digit code from your email.');
  }
  const email = parsed.data.email.toLowerCase();
  const user = await usersRepo.findActiveByEmail(email);
  if (!user) {
    // Still generic — but we can safely 401 since the code itself is a secret.
    throw new UnauthorizedError('Invalid verification code. Please try again.');
  }

  const row = await prRepo.latestActiveForUser(user.id);
  if (!row) {
    throw new UnauthorizedError('No active verification code. Please request a new one.');
  }
  if (row.is_expired) {
    await prRepo.markUsed(row.id);
    throw new ConflictError('This code has expired. Please request a new one.');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await prRepo.markUsed(row.id);
    throw new ConflictError('Too many attempts. Please request a new code.');
  }

  const ok = await bcrypt.compare(parsed.data.otp, row.otp_hash);
  if (!ok) {
    await prRepo.incrementAttempts(row.id);
    throw new UnauthorizedError('Invalid verification code. Please try again.');
  }

  // Generate a one-shot reset token (32 bytes hex = 64 chars) and store its hash.
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = await hashBcrypt(resetToken);
  await prRepo.attachResetToken(row.id, {
    resetTokenHash,
    ttlMinutes: RESET_TOKEN_TTL_MINUTES,
  });

  return { status: 'ok', resetToken };
}

export async function resetPassword(payload, ipAddress) {
  const parsed = resetSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues?.[0]?.message || 'Your password does not meet the requirements.',
      parsed.error.flatten().fieldErrors
    );
  }
  const email = parsed.data.email.toLowerCase();
  const user = await usersRepo.findActiveByEmail(email);
  if (!user) {
    throw new UnauthorizedError('Invalid or expired reset link.');
  }

  const candidates = await prRepo.findByResetTokenCandidates(user.id);
  if (candidates.length === 0) {
    throw new UnauthorizedError('Invalid or expired reset link.');
  }
  // Find the first matching unused token.
  let matched = null;
  for (const c of candidates) {
    const ok = await bcrypt.compare(parsed.data.resetToken, c.reset_token_hash);
    if (ok) {
      matched = c;
      break;
    }
  }
  if (!matched) {
    throw new UnauthorizedError('Invalid or expired reset link.');
  }

  const newHash = await hashBcrypt(parsed.data.newPassword);
  await withTransaction(async (conn) => {
    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
    await prRepo.markResetTokenUsed(matched.id);
    await auditRepo.log(
      conn,
      user.id,
      'PASSWORD_RESET',
      'USER',
      user.id,
      { via: 'otp' },
      ipAddress
    );
  });

  return { status: 'ok', message: 'Your password has been updated successfully.' };
}
