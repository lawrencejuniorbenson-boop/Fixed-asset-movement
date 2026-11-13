/**
 * src/middleware/auth.js
 * JWT authentication and role-based authorization middleware.
 *
 * authenticate  — verifies Bearer token, attaches decoded payload to req.user
 *                 Rejects unauthenticated or invalid tokens with HTTP 401
 * authorize     — factory that accepts allowed roles and 403s on mismatch
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

// Never fall back to a secret that is published in the source code: anyone
// could use it to forge an admin token.
function resolveJwtSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set (at least 32 characters) in production.');
  }
  console.warn('[auth] JWT_SECRET not set (or shorter than 32 chars): using a random per-process secret. Sessions end when the server restarts.');
  return crypto.randomBytes(48).toString('hex');
}

export const JWT_SECRET = resolveJwtSecret();

/**
 * Middleware: verify JWT from Authorization: Bearer <token> header.
 * Sets req.user = { id, role, name, email, department } on success.
 * Rejects requests without valid credentials with HTTP 401.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No valid authorization token provided.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Session expired or token is invalid. Please sign in again.'
    });
  }
}

/**
 * Middleware factory: restrict access to specified roles.
 * Must be used after authenticate().
 *
 * @param {...string} roles - Allowed role strings
 */
export function authorize(...roles) {
  return (req, res, next) => {
    // Admin always authorized
    if (req.user?.role === 'admin') return next();
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role(s): ${roles.join(', ')}.`,
      });
    }
    next();
  };
}
