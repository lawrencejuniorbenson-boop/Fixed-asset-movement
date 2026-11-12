/**
 * src/routes/requests.js
 * Asset Movement Request routes.
 */

import { Router } from 'express';
import db from '../db/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Helper to populate request with user info and items
function populateRequest(req) {
  if (!req) return null;
  const requester = db.getUserById(req.requesting_officer_id);
  const headApprover = req.head_approved_by ? db.getUserById(req.head_approved_by) : null;
  const amaOfficer = req.ama_officer_approved_by ? db.getUserById(req.ama_officer_approved_by) : null;
  const amaHead = req.ama_head_approved_by ? db.getUserById(req.ama_head_approved_by) : null;
  const amaClosed = req.ama_closed_by ? db.getUserById(req.ama_closed_by) : null;
  const items = db.getItemsByRequestId(req.id);
  const rawTransportTask = db.getTransportTaskByRequestId(req.id);

  let transportTask = null;
  if (rawTransportTask) {
    let officerName = rawTransportTask.assigned_officer_name;
    if (!officerName && rawTransportTask.assigned_officer_id) {
      const u = db.getUserById(rawTransportTask.assigned_officer_id);
      if (u) officerName = u.name;
    }
    const transportHead = rawTransportTask.transport_head_id ? db.getUserById(rawTransportTask.transport_head_id) : null;
    transportTask = {
      ...rawTransportTask,
      assigned_officer_name: officerName || null,
      transport_head_name: transportHead ? transportHead.name : null
    };
  }

  return {
    ...req,
    fulfillment_type: req.fulfillment_type || 'transport',
    requester_name: requester ? requester.name : 'Unknown',
    requester_email: requester ? requester.email : '',
    requester_department: requester ? requester.department : '',
    head_approver_name: req.head_approved_name || (headApprover ? headApprover.name : null),
    ama_officer_name: req.ama_officer_name || (amaOfficer ? amaOfficer.name : null),
    ama_head_name: req.ama_head_name || (amaHead ? amaHead.name : null),
    ama_closed_name: req.ama_closed_name || (amaClosed ? amaClosed.name : null),
    items,
    transport_task: transportTask,
    audit_log: db.getAuditLogs(req.id, null)
  };
}

// GET /api/requests/stats
router.get('/stats', (req, res) => {
  const allReqs = db.getRequests();
  const transportTasks = db.getTransportTasks();
  const { role, id } = req.user;

  // Requests created by the current user (e.g. requesting officer)
  const myRequests = allReqs.filter(r => r.requesting_officer_id === id);

  const stats = {
    // Global counts
    total: allReqs.length,
    pending_approval: allReqs.filter(r => ['pending_head', 'head_approved'].includes(r.status)).length,
    in_transport: allReqs.filter(r => ['fully_approved', 'in_transport'].includes(r.status)).length,
    transport_completed: allReqs.filter(r => r.status === 'transport_completed').length,
    closed: allReqs.filter(r => r.status === 'closed').length,
    rejected: allReqs.filter(r => r.status === 'rejected').length,

    // Specific counts for the requesting officer
    my_requests_count: myRequests.length,
    my_pending_count: myRequests.filter(r => ['pending_head', 'head_approved'].includes(r.status)).length,
    my_in_transport_count: myRequests.filter(r => ['fully_approved', 'in_transport'].includes(r.status)).length,
    my_closed_count: myRequests.filter(r => ['transport_completed', 'closed'].includes(r.status)).length,
    my_rejected_count: myRequests.filter(r => r.status === 'rejected').length,

    my_tasks: 0
  };

  if (role === 'requesting_officer') {
    stats.my_tasks = myRequests.length;
  } else if (role === 'department_head') {
    stats.my_tasks = allReqs.filter(r => r.status === 'pending_head').length;
  } else if (role === 'ama_officer') {
    stats.my_tasks = allReqs.filter(r => r.status === 'head_approved' || r.status === 'transport_completed').length;
  } else if (role === 'ama_head') {
    stats.my_tasks = allReqs.filter(r => r.status === 'head_approved').length;
  } else if (role === 'transport_head') {
    stats.my_tasks = transportTasks.filter(t => (t.fulfillment_type !== 'it') && t.status === 'pending_assignment').length;
  } else if (role === 'transport_officer') {
    stats.my_tasks = transportTasks.filter(t => (t.fulfillment_type !== 'it') && t.assigned_officer_id === id && t.status !== 'completed').length;
  } else if (role === 'it_head') {
    stats.my_tasks = transportTasks.filter(t => (t.fulfillment_type === 'it') && t.status === 'pending_assignment').length;
  } else if (role === 'it_officer') {
    stats.my_tasks = transportTasks.filter(t => (t.fulfillment_type === 'it') && t.assigned_officer_id === id && t.status !== 'completed').length;
  } else if (role === 'admin' || role === 'auditor') {
    stats.my_tasks = allReqs.length;
  }

  return res.json({ success: true, data: stats });
});

// ── Draft Routes (Strictly only 1 draft per user at a time) ───────────────────
// GET /api/requests/draft
router.get('/draft', (req, res) => {
  const userId = req.user.id;
  const draft = db.getDraft(userId);
  return res.json({ success: true, data: draft });
});

// POST /api/requests/draft
router.post('/draft', (req, res) => {
  const userId = req.user.id;
  const { form = {}, items = [] } = req.body;
  const saved = db.saveDraft(userId, { form, items });
  return res.json({
    success: true,
    data: saved,
    message: 'Draft saved. You can complete and submit this request at a later time.'
  });
});

// DELETE /api/requests/draft
router.delete('/draft', (req, res) => {
  const userId = req.user.id;
  db.deleteDraft(userId);
  return res.json({ success: true, message: 'Draft discarded.' });
});

// GET /api/requests
router.get('/', (req, res) => {
  const { role, id } = req.user;
  let requests = db.getRequests();

  // Admin, Auditor, Asset Officer (AMA Officer), and Head of Assets (AMA Head) see ALL requests without restriction
  if (role === 'admin' || role === 'auditor' || role === 'ama_officer' || role === 'ama_head') {
    // No filter applied - see all requests across the organization
  } else if (role === 'requesting_officer') {
    // Requesting officer sees requests they have made
    requests = requests.filter(r => r.requesting_officer_id === id);
  } else if (role === 'department_head') {
    // Unit/Dept Head sees pending approval in their unit + any they approved
    requests = requests.filter(r => r.status === 'pending_head' || r.head_approved_by === id);
  } else if (role === 'transport_head' || role === 'transport_officer') {
    // Transport unit only sees non-IT authorized requests for relocation
    requests = requests.filter(r => (r.fulfillment_type !== 'it') && ['fully_approved', 'in_transport', 'transport_completed', 'closed'].includes(r.status));
  } else if (role === 'it_head' || role === 'it_officer') {
    // IT unit only sees IT authorized requests for hardware movement
    requests = requests.filter(r => (r.fulfillment_type === 'it') && ['fully_approved', 'in_transport', 'transport_completed', 'closed'].includes(r.status));
  }

  const populated = requests
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(populateRequest);

  return res.json({ success: true, data: populated });
});

// GET /api/requests/:id (Protected with Object-Level Access Control)
router.get('/:id', (req, res) => {
  const request = db.getRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  const { role, id } = req.user;
  const isGlobalRole = ['admin', 'auditor', 'ama_officer', 'ama_head'].includes(role);
  const isRequester = request.requesting_officer_id === id;
  const isDeptHead = role === 'department_head' && (request.status === 'pending_head' || request.head_approved_by === id);
  const isLogisticsStaff = ['transport_head', 'transport_officer', 'it_head', 'it_officer'].includes(role) &&
    ['fully_approved', 'in_transport', 'transport_completed', 'closed'].includes(request.status);

  if (!isGlobalRole && !isRequester && !isDeptHead && !isLogisticsStaff) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. You do not have permission to view this movement request.'
    });
  }

  const populated = populateRequest(request);
  const audit_log = db.getAuditLogs(request.id, null);

  return res.json({ success: true, data: { ...populated, audit_log } });
});

// POST /api/requests
router.post('/', (req, res) => {
  const currentUser = req.user;
  const {
    present_location,
    new_location,
    purpose,
    officer_doing_movement,
    officer_doing_movement_staff_id,
    authorized_by,
    authorized_by_staff_id,
    requesting_officer_staff_id,
    department,
    unit,
    movement_date,
    priority = 'Normal',
    fulfillment_type = 'transport',
    signature_requester,
    items = []
  } = req.body;

  if (!present_location || !new_location || !purpose || !movement_date) {
    return res.status(400).json({
      success: false,
      error: 'Present location, new location, purpose, and movement date are required.'
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Please add at least one asset item to the movement request schedule.'
    });
  }

  // Detect whether items are IT assets (servers, racks, switches, routers, etc.)
  const hasItAssets = items.some(i => {
    const n = (i.name_of_asset || '').toLowerCase();
    return n.includes('server') || n.includes('switch') || n.includes('rack') || n.includes('router') || n.includes('ups') || n.includes('cisco');
  });
  const resolvedFulfillment = fulfillment_type === 'it' || hasItAssets ? 'it' : 'transport';

  try {
    const newRequest = db.createRequest({
      requesting_officer_id: currentUser.id,
      requesting_officer_staff_id: requesting_officer_staff_id || currentUser.staff_id || null,
      present_location,
      new_location,
      purpose,
      officer_doing_movement: officer_doing_movement || currentUser.name,
      officer_doing_movement_staff_id: officer_doing_movement_staff_id || null,
      authorized_by: authorized_by || null,
      authorized_by_staff_id: authorized_by_staff_id || null,
      department: department || currentUser.department || null,
      unit: unit || null,
      movement_date,
      priority,
      fulfillment_type: resolvedFulfillment,
      signature_requester: signature_requester || currentUser.name,
      items
    });

    // Log audit
    db.logAudit({
      movement_request_id: newRequest.id,
      action: 'REQUEST_SUBMITTED',
      performed_by: currentUser.id,
      performed_by_name: currentUser.name,
      remarks: `Movement request submitted with ${items.length} asset item(s) by ${currentUser.name} (Fulfillment: ${resolvedFulfillment === 'it' ? 'IT Infrastructure' : 'Transport & Logistics'})`
    });

    // Clean up draft upon successful submission (only 1 draft can exist at a time)
    db.deleteDraft(currentUser.id);

    const created = populateRequest(db.getRequestById(newRequest.id));
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[Create Request Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to create request.' });
  }
});

// POST /api/requests/:id/approve
router.post('/:id/approve', (req, res) => {
  const request = db.getRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  const { role, id, name } = req.user;
  const { remarks = '' } = req.body;
  const now = new Date().toISOString();

  const isAmaPool = role === 'ama_officer' || role === 'ama_head' || role === 'admin' || (req.user?.department && (req.user.department.includes('Asset') || req.user.department.includes('Archive') || req.user.department.includes('AMA')));

  // STAGE 1: Unit / Department Head Review & Approval
  if (request.status === 'pending_head') {
    if (role !== 'department_head' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only the Department Head can approve this stage.' });
    }

    db.updateRequest(request.id, {
      status: 'head_approved',
      head_approved_by: id,
      head_approved_name: name,
      head_approved_at: now,
      head_remarks: remarks
    });

    db.logAudit({
      movement_request_id: request.id,
      action: 'HEAD_APPROVED',
      performed_by: id,
      performed_by_name: `${name} (Unit Head)`,
      remarks: remarks || 'Departmental approval granted.'
    });

    return res.json({ success: true, message: 'Request approved by Department Head and forwarded to Asset Management \& Archives Pool.' });
  }

  // STAGE 2: Asset Management \& Archives Department Pool (Verification & Movement Authorization — combined)
  if (request.status === 'head_approved') {
    if (!isAmaPool) {
      return res.status(403).json({ success: false, error: 'Only members of the Asset Management \& Archives Department Pool can authorize this stage.' });
    }

    db.updateRequest(request.id, {
      status: 'fully_approved',
      ama_officer_approved_by: id,
      ama_officer_name: name,
      ama_officer_approved_at: now,
      ama_officer_remarks: remarks,
      ama_head_approved_by: id,
      ama_head_name: name,
      ama_head_signature: name,
      ama_head_approved_at: now,
      ama_head_remarks: remarks
    });

    db.logAudit({
      movement_request_id: request.id,
      action: 'AMA_POOL_VERIFIED_AND_AUTHORIZED',
      performed_by: id,
      performed_by_name: `${name} (Asset Management \& Archives Pool)`,
      remarks: remarks || `Asset register verified and movement authorized by ${name}. Relocation order generated.`
    });

    // Automatically create fulfillment task for Transport or IT Infrastructure
    const isItMove = request.fulfillment_type === 'it' ||
      (request.items && request.items.some(i => {
        const n = (i.name_of_asset || '').toLowerCase();
        return n.includes('server') || n.includes('switch') || n.includes('rack') || n.includes('router') || n.includes('ups') || n.includes('cisco');
      }));
    const taskType = isItMove ? 'it' : 'transport';
    const targetPoolName = isItMove ? 'IT Infrastructure & Systems Pool' : 'Transport & Logistics Pool';

    const existingTask = db.getTransportTaskByRequestId(request.id);
    if (!existingTask) {
      db.createTransportTask({
        movement_request_id: request.id,
        scheduled_date: request.movement_date,
        fulfillment_type: taskType
      });

      db.logAudit({
        movement_request_id: request.id,
        action: isItMove ? 'IT_LOGISTICS_ORDER_INITIATED' : 'TRANSPORT_ORDER_INITIATED',
        performed_by: id,
        performed_by_name: `${name} (Asset Management \& Archives Pool)`,
        remarks: isItMove
          ? 'Technical hardware logistics order automatically dispatched to IT Infrastructure Pool.'
          : 'Relocation logistics order automatically dispatched to Transport & Logistics Pool.'
      });
    }

    return res.json({
      success: true,
      message: `Asset register verified and movement authorized by ${name}! Request dispatched to ${targetPoolName}.`
    });
  }

  return res.status(400).json({ success: false, error: `Request cannot be approved in its current state: ${request.status}` });
});

// POST /api/requests/:id/reject
router.post('/:id/reject', (req, res) => {
  const request = db.getRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  const { remarks } = req.body;
  if (!remarks) {
    return res.status(400).json({ success: false, error: 'Please provide rejection remarks.' });
  }

  db.updateRequest(request.id, {
    status: 'rejected',
    rejection_remarks: remarks
  });

  db.logAudit({
    movement_request_id: request.id,
    action: 'REQUEST_REJECTED',
    performed_by: req.user.id,
    performed_by_name: req.user.name,
    remarks
  });

  return res.json({ success: true, message: 'Request has been rejected.' });
});

// POST /api/requests/:id/close
// STAGE 6: Asset Management \& Archives Department Pool confirms move completion, updates register, and closes request
router.post('/:id/close', (req, res) => {
  const isAmaPool = req.user?.role === 'ama_officer' || req.user?.role === 'ama_head' || req.user?.role === 'admin' || (req.user?.department && (req.user.department.includes('Asset') || req.user.department.includes('Archive') || req.user.department.includes('AMA')));
  if (!isAmaPool) {
    return res.status(403).json({ success: false, error: 'Only members of the Asset Management \& Archives Department Pool can close requests.' });
  }

  const request = db.getRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  if (request.status !== 'transport_completed') {
    return res.status(400).json({
      success: false,
      error: 'Request cannot be closed until physical transport relocation is completed.'
    });
  }

  const { remarks = '' } = req.body;
  const now = new Date().toISOString();

  db.updateRequest(request.id, {
    status: 'closed',
    ama_closed_by: req.user.id,
    ama_closed_name: req.user.name,
    ama_closed_at: now,
    ama_closing_remarks: remarks
  });

  db.logAudit({
    movement_request_id: request.id,
    action: 'REGISTER_UPDATED_AND_CLOSED_BY_AMA_POOL',
    performed_by: req.user.id,
    performed_by_name: `${req.user.name} (Asset Management \& Archives Pool)`,
    remarks: remarks || `Fixed Asset Register records updated and closed by ${req.user.name}.`
  });

  return res.json({
    success: true,
    message: `Fixed Asset Register records updated and closed by ${req.user.name}!`
  });
});

export default router;
