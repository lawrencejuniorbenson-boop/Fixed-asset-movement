/**
 * src/db/database.js
 * Pure JS file-persisted JSON database engine.
 * Fully compatible with Node 26 without native C++ compilation.
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_FILE = join(__dirname, 'data.json');

const defaultData = {
  users: [],
  movement_requests: [],
  movement_items: [],
  transport_tasks: [],
  audit_log: [],
  counters: {
    users: 0,
    movement_requests: 0,
    movement_items: 0,
    transport_tasks: 0,
    audit_log: 0,
  }
};

class JsonDB {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading db file, initializing fresh:', err);
    }
    this.save(defaultData);
    return JSON.parse(JSON.stringify(defaultData));
  }

  save(data = this.data) {
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.filePath);
  }

  nextId(table) {
    if (!this.data.counters[table]) {
      this.data.counters[table] = 0;
    }
    this.data.counters[table] += 1;
    this.save();
    return this.data.counters[table];
  }

  // Users table helpers
  getUsers() { return this.data.users; }
  getUserById(id) { return this.data.users.find(u => u.id === Number(id)); }
  getUserByEmail(email) { return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()); }
  createUser(user) {
    const id = this.nextId('users');
    const newUser = {
      id,
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      department: user.department || 'Corporate Bank',
      created_at: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  // Movement requests helpers
  getRequests() { return this.data.movement_requests; }
  getRequestById(id) { return this.data.movement_requests.find(r => r.id === Number(id)); }
  generateReferenceNo() {
    const year = new Date().getFullYear();
    const count = (this.data.counters['movement_requests'] || 0) + 1;
    return `FAM-${year}-${String(count).padStart(4, '0')}`;
  }
  
  createRequest(reqData) {
    const id = this.nextId('movement_requests');
    const year = new Date().getFullYear();
    const seq = String(id).padStart(4, '0');
    const reference_no = reqData.reference_no || `FAM-${year}-${seq}`;

    const newReq = {
      id,
      reference_no,
      requesting_officer_id: reqData.requesting_officer_id,
      present_location: reqData.present_location,
      new_location: reqData.new_location,
      purpose: reqData.purpose,
      officer_doing_movement: reqData.officer_doing_movement || '',
      officer_doing_movement_staff_id: reqData.officer_doing_movement_staff_id || null,
      authorized_by: reqData.authorized_by || '',
      authorized_by_staff_id: reqData.authorized_by_staff_id || null,
      requesting_officer_staff_id: reqData.requesting_officer_staff_id || null,
      department: reqData.department || null,
      unit: reqData.unit || null,
      movement_date: reqData.movement_date,
      signature_requester: reqData.signature_requester || 'Signed Digitally',
      priority: reqData.priority || 'Normal',
      fulfillment_type: reqData.fulfillment_type || 'transport',
      status: 'pending_head', // pending_head -> head_approved -> ama_officer_approved -> fully_approved -> in_transport -> transport_completed -> closed | rejected
      
      // Step 1: Requesting Dept / Unit Head
      head_approved_by: null,
      head_approved_at: null,
      head_remarks: null,
      head_signature: null,

      // Step 2: Asset Management \& Archives (AMA) Officer
      ama_officer_approved_by: null,
      ama_officer_approved_at: null,
      ama_officer_remarks: null,

      // Step 3: Head of Asset Management \& Archives (Head, Fixed Assets)
      ama_head_approved_by: null,
      ama_head_approved_at: null,
      ama_head_remarks: null,
      ama_head_signature: null,

      // Final Record Closure by AMA
      ama_closed_by: null,
      ama_closed_at: null,
      ama_closing_remarks: null,

      created_at: new Date().toISOString()
    };

    this.data.movement_requests.push(newReq);

    // Save items
    if (Array.isArray(reqData.items) && reqData.items.length > 0) {
      reqData.items.forEach((item, index) => {
        const itemId = this.nextId('movement_items');
        this.data.movement_items.push({
          id: itemId,
          movement_request_id: id,
          item_no: item.item_no || (index + 1),
          name_of_asset: item.name_of_asset || '',
          asset_code: item.asset_code || ''
        });
      });
    }

    this.save();
    return newReq;
  }

  updateRequest(id, updates) {
    const req = this.getRequestById(id);
    if (!req) return null;
    Object.assign(req, updates);
    this.save();
    return req;
  }

  getItemsByRequestId(requestId) {
    return this.data.movement_items
      .filter(i => i.movement_request_id === Number(requestId))
      .sort((a, b) => a.item_no - b.item_no);
  }

  // Fulfillment Tasks helpers (Transport & Logistics / IT Infrastructure)
  getTransportTasks() { return this.data.transport_tasks; }
  getTransportTaskById(id) { return this.data.transport_tasks.find(t => t.id === Number(id)); }
  getTransportTaskByRequestId(requestId) { return this.data.transport_tasks.find(t => t.movement_request_id === Number(requestId)); }

  createTransportTask(input) {
    const id = this.nextId('transport_tasks');
    const reqId = typeof input === 'object' && input !== null ? input.movement_request_id : input;
    const schedDate = typeof input === 'object' && input !== null ? input.scheduled_date : null;
    const fulfillType = typeof input === 'object' && input !== null ? (input.fulfillment_type || 'transport') : 'transport';

    const task = {
      id,
      movement_request_id: Number(reqId),
      fulfillment_type: fulfillType,
      transport_head_id: null,
      assigned_officer_id: null,
      assigned_officer_name: null,
      vehicle_details: null,
      driver_name: null,
      scheduled_date: schedDate || null,
      assessment_notes: null,
      status: 'pending_assignment', // pending_assignment -> officer_assigned -> in_progress -> completed
      assignment_notes: null,
      completion_notes: null,
      completed_at: null,
      ama_notified_at: null,
      created_at: new Date().toISOString()
    };
    this.data.transport_tasks.push(task);
    this.save();
    return task;
  }

  updateTransportTask(id, updates) {
    const task = this.getTransportTaskById(id);
    if (!task) return null;
    Object.assign(task, updates);
    this.save();
    return task;
  }

  // Audit Log
  addAuditLog({ requestId, transportTaskId, action, performedBy, remarks }) {
    const id = this.nextId('audit_log');
    const log = {
      id,
      request_id: requestId ? Number(requestId) : null,
      transport_task_id: transportTaskId ? Number(transportTaskId) : null,
      action,
      performed_by: performedBy ? Number(performedBy) : null,
      remarks: remarks || null,
      created_at: new Date().toISOString()
    };
    this.data.audit_log.push(log);
    this.save();
    return log;
  }

  logAudit(params) {
    return this.addAuditLog({
      requestId: params.movement_request_id || params.requestId,
      transportTaskId: params.transportTaskId,
      action: params.action,
      performedBy: params.performed_by || params.performedBy,
      remarks: params.remarks
    });
  }

  getAuditLogs(requestId, transportTaskId) {
    return this.data.audit_log
      .filter(l => 
        (requestId && l.request_id === Number(requestId)) ||
        (transportTaskId && l.transport_task_id === Number(transportTaskId))
      )
      .map(log => {
        const user = this.getUserById(log.performed_by);
        return {
          ...log,
          performed_by_name: user ? user.name : 'System'
        };
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  // Draft methods - strictly ensures only ONE draft can exist per user at a time
  getDraft(userId) {
    if (!this.data.drafts) this.data.drafts = {};
    return this.data.drafts[String(userId)] || null;
  }

  saveDraft(userId, draftData) {
    if (!this.data.drafts) this.data.drafts = {};
    const draft = {
      ...draftData,
      user_id: Number(userId),
      updated_at: new Date().toISOString()
    };
    // Strictly overwrites any previous draft so only one draft is maintained
    this.data.drafts[String(userId)] = draft;
    this.save();
    return draft;
  }

  deleteDraft(userId) {
    if (!this.data.drafts) this.data.drafts = {};
    delete this.data.drafts[String(userId)];
    this.save();
    return true;
  }
}

const db = new JsonDB(DB_FILE);
export default db;
