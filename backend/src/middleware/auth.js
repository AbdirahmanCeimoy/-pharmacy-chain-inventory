// Auth middleware.
// authenticate     — verifies Bearer JWT, attaches req.user = { id, role, branchId, email }.
// requireRole(...) — 403 unless the authenticated user's role is in the list.
// requireBranch(id resolver) — 403 unless MANAGER/PHARMACIST is on their own branch (OWNER passes).
//
// Why server-side: the baseline explicitly penalises "permissions hidden only in the UI",
// so every mutation route stacks these middlewares before touching the service layer.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }
  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      branchId: payload.branchId ?? null,
      email: payload.email,
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

// OWNER sees everything; others must match the resolved branch.
export function requireOwnBranchOrOwner(resolveBranchId) {
  return async (req, _res, next) => {
    try {
      if (!req.user) return next(new UnauthorizedError());
      if (req.user.role === 'OWNER') return next();
      const branchId = await resolveBranchId(req);
      if (branchId == null || Number(branchId) !== Number(req.user.branchId)) {
        return next(new ForbiddenError('You can only act on your own branch'));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
