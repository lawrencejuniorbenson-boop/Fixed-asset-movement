/**
 * src/routes/transport.js
 * Transport & Logistics and IT Relocation Task routes.
 */

import { Router } from 'express';
import db from '../db/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import activeDirectoryService from '../services/activeDirectoryService.js';
import { INSTITUTIONAL_FLEET, INSTITUTIONAL_DRIVERS } from '../db/fleetData.js';

const router = Router();
router.use(authenticate);

// Helper to populate transport task
function populateTransportTask(task) {
  if (!task) return null;
  const req = db.getRequestById(task.movement_request_id);
  const requester = req ? db.getUserById(req.requesting_officer_id) : null;
  const transportHead = task.transport_head_id ? db.getUserById(task.transport_head_id) : null;
  const assignedOfficer = task.assigned_officer_id ? db.getUserById(task.assigned_officer_id) : null;
  const items = req ? db.getItemsByRequestId(req.id) : [];

  const officerName = task.assigned_officer_name || (assignedOfficer ? assignedOfficer.name : null) || null;

  return {
    ...task,
    request: req ? {
      ...req,
      requester_name: requester ? requester.name : 'Unknown',
      items
    } : null,
    transport_head_name: transportHead ? transportHead.name : null,
    assigned_officer_name: officerName,
    driver_name: task.driver_name || null,
    driver_type: task.driver_type || (task.driver_name ? 'internal' : (task.vendor_name ? 'vendor' : 'unassigned')),
    vendor_name: task.vendor_name || null,
    items
  };
}

// GET /api/transport/fleet — Live availability & assignment status of all cars and drivers
router.get('/fleet', authorize('transport_head', 'transport_officer', 'admin', 'ama_officer', 'ama_head'), (_req, res) => {
  const allTasks = db.getTransportTasks();
  const activeTasks = allTasks.filter(t => t.status !== 'completed');

  // Correlate vehicles
  const vehicles = INSTITUTIONAL_FLEET.map(veh => {
    // Check if vehicle is assigned to any active task
    const assignedTask = activeTasks.find(t => {
      const vDetails = (t.vehicle_details || '').toUpperCase();
      const vReg = (veh.reg_number || '').toUpperCase();
      const vName = (veh.name || '').toUpperCase();
      return vDetails.includes(vReg) || (vDetails.includes('SPRINTER') && vName.includes('SPRINTER')) || (vDetails.includes('ISUZU') && vName.includes('ISUZU'));
    });

    if (assignedTask) {
      const req = db.getRequestById(assignedTask.movement_request_id);
      const officer = assignedTask.assigned_officer_id ? db.getUserById(assignedTask.assigned_officer_id) : null;
      const items = req ? db.getItemsByRequestId(req.id) : [];

      return {
        ...veh,
        status: 'assigned',
        active_task: {
          task_id: assignedTask.id,
          request_id: assignedTask.movement_request_id,
          reference_no: req ? req.reference_no : `REQ-${assignedTask.movement_request_id}`,
          present_location: req ? req.present_location : 'Branch',
          new_location: req ? req.new_location : 'Head Office',
          scheduled_date: assignedTask.scheduled_date,
          status: assignedTask.status,
          assigned_officer_name: officer ? officer.name : 'Transport Officer',
          items_count: items.length
        }
      };
    }

    return {
      ...veh,
      status: 'available',
      active_task: null
    };
  });

  // Correlate drivers
  const drivers = INSTITUTIONAL_DRIVERS.map(driver => {
    const assignedTask = activeTasks.find(t => {
      return (
        t.assigned_officer_id === driver.id ||
        (t.assigned_officer_name && t.assigned_officer_name.toLowerCase().includes(driver.name.toLowerCase())) ||
        (t.vehicle_details && t.vehicle_details.toLowerCase().includes(driver.name.toLowerCase()))
      );
    });

    if (assignedTask) {
      const req = db.getRequestById(assignedTask.movement_request_id);
      return {
        ...driver,
        status: 'assigned',
        active_task: {
          task_id: assignedTask.id,
          request_id: assignedTask.movement_request_id,
          reference_no: req ? req.reference_no : `REQ-${assignedTask.movement_request_id}`,
          vehicle_details: assignedTask.vehicle_details,
          present_location: req ? req.present_location : 'Branch',
          new_location: req ? req.new_location : 'Head Office',
          scheduled_date: assignedTask.scheduled_date,
          status: assignedTask.status
        }
      };
    }

    return {
      ...driver,
      status: 'available',
      active_task: null
    };
  });

  const availableVehiclesCount = vehicles.filter(v => v.status === 'available').length;
  const assignedVehiclesCount = vehicles.filter(v => v.status === 'assigned').length;
  const availableDriversCount = drivers.filter(d => d.status === 'available').length;
  const assignedDriversCount = drivers.filter(d => d.status === 'assigned').length;

  return res.json({
    success: true,
    data: {
      metrics: {
        total_vehicles: vehicles.length,
        available_vehicles: availableVehiclesCount,
        assigned_vehicles: assignedVehiclesCount,
        total_drivers: drivers.length,
        available_drivers: availableDriversCount,
        assigned_drivers: assignedDriversCount,
        active_missions: activeTasks.length
      },
      vehicles,
      drivers,
      active_tasks: activeTasks.map(populateTransportTask)
    }
  });
});

// GET /api/transport/officers — transport / IT pool personnel dropdown
router.get('/officers', authorize('transport_head', 'transport_officer', 'it_head', 'it_officer', 'admin'), (req, res) => {
  const isIt = req.query.type === 'it' || req.user.role === 'it_head' || req.user.role === 'it_officer';
  const officers = db.getUsers()
    .filter(u => {
      if (isIt) {
        return u.role === 'it_officer' || u.role === 'it_head' || (u.department && (u.department.includes('IT') || u.department.includes('Information')));
      }
      return u.role === 'transport_officer' || u.role === 'transport_head' || (u.department && u.department.includes('Transport'));
    })
    .map(u => {
      const adStaff = activeDirectoryService.getStaffByAnyIdentifier(u.email);
      let staffId = adStaff ? adStaff.staff_id : (u.role.includes('head') ? 'EMP-0033' : 'EMP-0189');
      let jobTitle = adStaff ? adStaff.job_title : (u.role.includes('head') ? 'Unit Head' : 'Operations Officer');
      if (isIt && !adStaff) {
        staffId = u.role === 'it_head' ? 'EMP-0045' : 'EMP-0092';
        jobTitle = u.role === 'it_head' ? 'Head, IT Infrastructure' : 'IT Hardware Specialist';
      }
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department,
        staff_id: staffId,
        job_title: jobTitle
      };
    });
  return res.json({ success: true, data: officers });
});

// GET /api/transport — list tasks
router.get('/', authorize('transport_head', 'transport_officer', 'it_head', 'it_officer', 'ama_officer', 'ama_head', 'admin', 'auditor'), (req, res) => {
  const { role, id } = req.user;
  const filterType = req.query.type; // 'it' | 'transport' | undefined
  let tasks = db.getTransportTasks();

  if (filterType === 'it' || role === 'it_head') {
    tasks = tasks.filter(t => t.fulfillment_type === 'it');
  } else if (filterType === 'transport' || role === 'transport_head') {
    tasks = tasks.filter(t => t.fulfillment_type !== 'it');
  }

  if (role === 'transport_officer') {
    tasks = tasks.filter(t => t.assigned_officer_id === id && t.fulfillment_type !== 'it');
  } else if (role === 'it_officer') {
    tasks = tasks.filter(t => t.assigned_officer_id === id && t.fulfillment_type === 'it');
  }

  const populated = tasks
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(populateTransportTask);

  return res.json({ success: true, data: populated });
});

// GET /api/transport/:id — task detail
router.get('/:id', authorize('transport_head', 'transport_officer', 'it_head', 'it_officer', 'ama_officer', 'ama_head', 'admin', 'auditor'), (req, res) => {
  const task = db.getTransportTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Transport task not found.' });
  }

  const populated = populateTransportTask(task);
  const audit_log = db.getAuditLogs(task.movement_request_id, task.id);

  return res.json({ success: true, data: { ...populated, audit_log } });
});

// POST /api/transport/:id/assign — Transport or IT Pool assigns officer + vehicle/transit method
router.post('/:id/assign', authorize('transport_head', 'transport_officer', 'it_head', 'it_officer', 'admin'), (req, res) => {
  const {
    assigned_officer_id,
    assigned_officer_name,
    vehicle_details,
    driver_type,
    driver_name,
    vendor_name,
    scheduled_date,
    assessment_notes,
    assignment_notes
  } = req.body;
  const taskId = Number(req.params.id);

  if (!assigned_officer_id || !vehicle_details || !scheduled_date) {
    return res.status(400).json({
      success: false,
      error: 'Assigned officer, vehicle/transit details, and scheduled date are required.'
    });
  }

  const task = db.getTransportTaskById(taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Relocation task not found.' });
  }

  const isIt = task.fulfillment_type === 'it';
  const poolLabel = isIt ? 'IT Infrastructure Pool' : 'Transport & Logistics Pool';
  const defaultOfficerName = isIt ? 'IT Hardware Specialist' : 'Transport Officer';

  let officer = db.getUserById(assigned_officer_id) || db.getUserByEmail(assigned_officer_id);
  if (!officer) {
    const adStaff = activeDirectoryService.getStaffByAnyIdentifier(assigned_officer_id);
    if (adStaff) {
      officer = {
        id: Number(assigned_officer_id) || (isIt ? 10 : 7),
        name: adStaff.name,
        role: adStaff.system_role || (isIt ? 'it_officer' : 'transport_officer'),
        department: adStaff.department
      };
    }
  }

  const assignedId = Number(assigned_officer_id) || officer?.id || (isIt ? 10 : 7);
  const resolvedOfficerName = assigned_officer_name || (officer ? officer.name : defaultOfficerName);
  const resolvedDriverName = driver_name?.trim() || (driver_type === 'vendor' ? (vendor_name?.trim() || 'Logistics Vendor') : null);

  db.updateTransportTask(taskId, {
    status: 'officer_assigned',
    transport_head_id: req.user.id,
    transport_head_name: req.user.name,
    assigned_officer_id: assignedId,
    assigned_officer_name: resolvedOfficerName,
    vehicle_details: vehicle_details.trim(),
    driver_type: driver_type || (resolvedDriverName ? 'internal' : 'vendor'),
    driver_name: resolvedDriverName,
    vendor_name: vendor_name?.trim() || null,
    scheduled_date,
    assessment_notes: assessment_notes?.trim() || null,
    assignment_notes: assignment_notes?.trim() || null
  });

  const driverLog = resolvedDriverName ? ` Driver/Escort: ${resolvedDriverName}.` : '';
  db.addAuditLog({
    requestId: task.movement_request_id,
    transportTaskId: taskId,
    action: isIt ? 'IT_HARDWARE_LOGISTICS_ARRANGED' : 'TRANSPORT_ARRANGED_BY_POOL',
    performedBy: req.user.id,
    remarks: `${isIt ? 'IT Equipment Pickup & Handling' : 'Transport arrangements'} confirmed by ${req.user.name} (${poolLabel}). Officer: ${resolvedOfficerName}. Carrier/Details: ${vehicle_details}.${driverLog} Scheduled Date: ${scheduled_date}.`
  });

  const updated = populateTransportTask(db.getTransportTaskById(taskId));
  return res.json({ success: true, data: updated });
});

// POST /api/transport/:id/start — Any member of Transport or IT Pool can start relocation
router.post('/:id/start', authorize('transport_head', 'transport_officer', 'it_head', 'it_officer', 'admin'), (req, res) => {
  const taskId = Number(req.params.id);
  const task = db.getTransportTaskById(taskId);

  if (!task) {
    return res.status(404).json({ success: false, error: 'Relocation task not found.' });
  }

  const isIt = task.fulfillment_type === 'it';
  const poolLabel = isIt ? 'IT Infrastructure Pool' : 'Transport & Logistics Pool';

  db.updateTransportTask(taskId, {
    status: 'in_progress',
    transport_started_by: req.user.id,
    transport_started_name: req.user.name
  });
  db.updateRequest(task.movement_request_id, { status: 'in_transport' });

  db.addAuditLog({
    requestId: task.movement_request_id,
    transportTaskId: taskId,
    action: isIt ? 'IT_EQUIPMENT_PICKUP_STARTED' : 'TRANSPORT_STARTED_BY_POOL',
    performedBy: req.user.id,
    remarks: `${isIt ? 'Technical equipment pickup & transit' : 'Physical movement'} commenced by ${req.user.name} (${poolLabel}).`
  });

  const updated = populateTransportTask(db.getTransportTaskById(taskId));
  return res.json({ success: true, data: updated });
});

// POST /api/transport/:id/complete — Any member of Transport or IT Pool completes move & notifies AMA
router.post('/:id/complete', authorize('transport_head', 'transport_officer', 'it_head', 'it_officer', 'admin'), (req, res) => {
  const { completion_notes } = req.body;
  const taskId = Number(req.params.id);
  const task = db.getTransportTaskById(taskId);

  if (!task) {
    return res.status(404).json({ success: false, error: 'Relocation task not found.' });
  }

  const isIt = task.fulfillment_type === 'it';
  const poolLabel = isIt ? 'IT Infrastructure Pool' : 'Transport & Logistics Pool';
  const now = new Date().toISOString();

  db.updateTransportTask(taskId, {
    status: 'completed',
    completion_notes: completion_notes?.trim() || (isIt ? 'IT hardware and servers safely installed and verified at destination.' : 'Assets physically relocated and verified at destination.'),
    completed_at: now,
    ama_notified_at: now,
    transport_completed_by: req.user.id,
    transport_completed_name: req.user.name
  });

  db.updateRequest(task.movement_request_id, {
    status: 'transport_completed'
  });

  db.addAuditLog({
    requestId: task.movement_request_id,
    transportTaskId: taskId,
    action: isIt ? 'IT_RELOCATION_COMPLETED' : 'RELOCATION_COMPLETED_BY_TRANSPORT_POOL',
    performedBy: req.user.id,
    remarks: `${isIt ? 'IT Equipment installation and relocation' : 'Relocation'} completed and verified by ${req.user.name} (${poolLabel}). AMA Pool notified.`
  });

  const updated = populateTransportTask(db.getTransportTaskById(taskId));
  return res.json({ success: true, data: updated });
});

export default router;
