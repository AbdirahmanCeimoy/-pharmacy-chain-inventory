// Auth service: single source of truth for login + me.
// Keeps bcrypt + jwt contained here so routes stay thin.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as usersRepo from '../repositories/users.repo.js';
import { UnauthorizedError } from '../utils/errors.js';

function publicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    branchId: row.branch_id,
  };
}

export async function login(email, password) {
  const user = await usersRepo.findActiveByEmail(email);
  // Same error for unknown email and wrong password — avoids user enumeration.
  if (!user) throw new UnauthorizedError('Invalid email or password');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new UnauthorizedError('Invalid email or password');

  await usersRepo.touchLastLogin(user.id);

  const token = jwt.sign(
    { sub: String(user.id), role: user.role, branchId: user.branch_id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
  return { token, user: publicUser(user) };
}

export async function me(userId) {
  const user = await usersRepo.findById(userId);
  if (!user || !user.is_active) throw new UnauthorizedError();
  return publicUser(user);
}
