/**
 * src/routes/auth.js
 * Authentication routes with brute-force rate-limiting and timing attack protections.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/database.js';
import { authenticate, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// Constant-time dummy hash to mitigate timing-based user enumeration attacks
const DUMMY_HASH = bcrypt.hashSync('DummyPassword123!', 10);

// In-memory rate limiting map for login attempts: key -> { attempts, lockUntil }
const loginAttemptMap = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

function getClientKey(req, email) {
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  return `${ip}::${(email || '').trim().toLowerCase()}`;
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const clientKey = getClientKey(req, email);
  const now = Date.now();
  const attemptRecord = loginAttemptMap.get(clientKey);

  // Check if account / IP is currently locked out
  if (attemptRecord && attemptRecord.lockUntil > now) {
    const remainingMinutes = Math.ceil((attemptRecord.lockUntil - now) / 60000);
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Terminal locked for security. Please try again in ${remainingMinutes} minute(s).`
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.getUserByEmail(normalizedEmail);

  // Use real password hash or dummy hash to maintain constant response timing
  const hashToCompare = user ? user.password : DUMMY_HASH;
  const valid = bcrypt.compareSync(password, hashToCompare);

  if (!user || !valid) {
    // Record failed attempt
    const currentAttempts = (attemptRecord && attemptRecord.lockUntil <= now)
      ? 1
      : ((attemptRecord?.attempts || 0) + 1);

    const lockUntil = currentAttempts >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0;
    loginAttemptMap.set(clientKey, { attempts: currentAttempts, lockUntil });

    if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        error: 'Maximum sign-in attempts exceeded. Terminal locked for 15 minutes for corporate security compliance.'
      });
    }

    const remaining = MAX_FAILED_ATTEMPTS - currentAttempts;
    return res.status(401).json({
      success: false,
      error: `Invalid corporate email or password. (${remaining} attempt(s) remaining before lockout)`
    });
  }

  // Login successful: reset rate-limiting record
  loginAttemptMap.delete(clientKey);

  const payload = {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    department: user.department
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

  return res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    },
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const { password, ...safeUser } = user;
  return res.json({ success: true, data: safeUser });
});

export default router;
