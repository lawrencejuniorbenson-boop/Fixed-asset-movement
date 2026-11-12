/**
 * src/routes/users.js
 * User management routes — admin only.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

const VALID_ROLES = [
  'requesting_officer',
  'department_head',
  'ama_officer',
  'ama_head',
  'transport_head',
  'transport_officer',
  'it_head',
  'it_officer',
  'admin',
  'auditor'
];

router.use(authenticate, authorize('admin'));

// GET /api/users
router.get('/', (_req, res) => {
  const users = db.getUsers().map(u => {
    const { password, ...safe } = u;
    return safe;
  });
  return res.json({ success: true, data: users });
});

// POST /api/users
router.post('/', async (req, res) => {
  const { name, email, password, role, department } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, error: 'Name, email, password, and role are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long for corporate compliance.' });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.` });
  }

  const existing = db.getUserByEmail(email.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const newUser = db.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      role,
      department: department || 'Corporate Bank'
    });

    const { password: _, ...safe } = newUser;
    return res.status(201).json({ success: true, data: safe });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
