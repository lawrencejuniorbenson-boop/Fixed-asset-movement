/**
 * src/routes/directory.js
 * Active Directory integration endpoints for picking staff info live.
 */

import { Router } from 'express';
import activeDirectoryService from '../services/activeDirectoryService.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/directory/search?q=...&department=...&role=...
router.get('/search', (req, res) => {
  const { q = '', department = '', role = '', limit = 15 } = req.query;
  const staff = activeDirectoryService.searchStaff({
    query: q,
    department,
    role,
    limit: Number(limit)
  });
  return res.json({ success: true, data: staff });
});

// GET /api/directory/staff/:identifier (Staff ID, email, sAMAccountName)
router.get('/staff/:identifier', (req, res) => {
  const staff = activeDirectoryService.getStaffByAnyIdentifier(req.params.identifier);
  if (!staff) {
    return res.status(404).json({ success: false, error: 'Staff member not found in Active Directory.' });
  }

  // Also include supervisor details
  const supervisor = activeDirectoryService.getStaffSupervisor(staff.staff_id);
  return res.json({
    success: true,
    data: {
      ...staff,
      supervisor: supervisor || null
    }
  });
});

// GET /api/directory/departments
router.get('/departments', (_req, res) => {
  const departments = activeDirectoryService.getDepartments();
  return res.json({ success: true, data: departments });
});

// GET /api/directory/status
router.get('/status', (_req, res) => {
  const status = activeDirectoryService.getStatus();
  return res.json({ success: true, data: status });
});

// POST /api/directory/test-connection
router.post('/test-connection', (_req, res) => {
  const result = activeDirectoryService.testConnection();
  return res.json({ success: true, data: result });
});

export default router;

