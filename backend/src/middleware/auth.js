/**
 * src/middleware/auth.js
 * JWT authentication and role-based authorization middleware.
 *
 * authenticate  — verifies Bearer token, attaches decoded payload to req.user
 *                 Rejects unauthenticated or invalid tokens with HTTP 401
 * authorize     — factory that accepts allowed roles and 403s on mismatch
 */

import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'FAM_ENTERPRISE_JWT_SECRET_2026_SECURE';

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
