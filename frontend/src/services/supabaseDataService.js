/**
 * frontend/src/services/supabaseDataService.js
 * Comprehensive Direct-to-Supabase backend operations.
 * Allows the frontend to run 100% serverless against Supabase Cloud.
 */

import { getSupabase } from '../lib/supabase'

// Staff names come from public.users (readable by every staff member).
// Names are cached for a short time to avoid re-reading them on every call.
let nameCache = { at: 0, map: {} }
async function getNameMap(supabase, force = false) {
  if (!force && Date.now() - nameCache.at < 30000) return nameCache.map
  const { data } = await supabase.from('users').select('id, name, department, staff_id, role')
  const map = {}
  ;(data || []).forEach(u => { map[u.id] = u })
  nameCache = { at: Date.now(), map }
  return map
}

// Only what is actually recorded is shown. Nothing is inferred or invented:
// this data backs an audit trail.
export function populateTaskRecord(t) {
  if (!t) return null
  return { ...t, fulfillment_type: t.fulfillment_type === 'it' ? 'it' : 'transport' }
}

export function populateRequestRecord(r, names = {}) {
  if (!r) return null
  const rawTask = Array.isArray(r.transport_task) ? r.transport_task[0] : r.transport_task
  const requester = names[r.requesting_officer_id]
  const auditLog = [...(r.audit_log || [])]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(log => ({
      ...log,
      performed_by_name: log.performed_by_name || names[log.performed_by]?.name || 'Unknown user'
    }))

  return {
    ...r,
    fulfillment_type: r.fulfillment_type === 'it' ? 'it' : 'transport',
    requester_name: requester?.name || 'Unknown requester',
    requester_department: r.department || requester?.department || '',
    requester_staff_id: r.requesting_officer_staff_id || requester?.staff_id || '',
    head_approver_name: r.head_approved_name || null,
    ama_officer_name: r.ama_officer_name || null,
    ama_head_name: r.ama_head_name || null,
    ama_closed_name: r.ama_closed_name || null,
    rejected_by_name: r.rejected_by ? (names[r.rejected_by]?.name || null) : null,
    items: [...(r.items || [])].sort((a, b) => (a.item_no || 0) - (b.item_no || 0)),
    transport_task: populateTaskRecord(rawTask),
    audit_log: auditLog
  }
}

// Row Level Security hides rows a user may not change, so a blocked UPDATE
// affects 0 rows without raising an error. Re-read and confirm it applied.
async function assertStatus(supabase, table, id, expected) {
  const { data } = await supabase.from(table).select('status').eq('id', id).maybeSingle()
  if (!data || data.status !== expected) {
    throw new Error('You are not authorized to perform this action at the current stage.')
  }
}

export const supabaseDataService = {
  // ── STATS ───────────────────────────────────────────────────────────────────
  async getStats(role, userId) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const { data: allReqs, error } = await supabase
      .from('movement_requests')
      .select('id, status, requesting_officer_id')

    if (error) throw error

    const reqs = allReqs || []
    const myReqs = reqs.filter(r => String(r.requesting_officer_id) === String(userId))

    return {
      total: reqs.length,
      pending_approval: reqs.filter(r => ['pending_head', 'head_approved', 'ama_officer_approved'].includes(r.status)).length,
      in_transport: reqs.filter(r => ['fully_approved', 'in_transport'].includes(r.status)).length,
      transport_completed: reqs.filter(r => r.status === 'transport_completed').length,
      closed: reqs.filter(r => r.status === 'closed').length,
      rejected: reqs.filter(r => r.status === 'rejected').length,

      my_requests_count: myReqs.length,
      my_pending_count: myReqs.filter(r => ['pending_head', 'head_approved', 'ama_officer_approved'].includes(r.status)).length,
      my_in_transport_count: myReqs.filter(r => ['fully_approved', 'in_transport'].includes(r.status)).length,
      my_closed_count: myReqs.filter(r => ['transport_completed', 'closed'].includes(r.status)).length,
      my_rejected_count: myReqs.filter(r => r.status === 'rejected').length
    }
  },

  // ── REQUESTS ────────────────────────────────────────────────────────────────
  async getRequests(role, userId) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    let query = supabase
      .from('movement_requests')
      .select('*')
      .order('created_at', { ascending: false })

    // Role-based visibility
    if (role === 'requesting_officer') {
      query = query.eq('requesting_officer_id', userId)
    } else if (role === 'department_head') {
      query = query.or(`status.eq.pending_head,head_approved_by.eq.${userId}`)
    } else if (role === 'transport_head' || role === 'transport_officer') {
      query = query.neq('fulfillment_type', 'it').in('status', ['fully_approved', 'in_transport', 'transport_completed', 'closed'])
    } else if (role === 'it_head' || role === 'it_officer') {
      query = query.eq('fulfillment_type', 'it').in('status', ['fully_approved', 'in_transport', 'transport_completed', 'closed'])
    }
    // admin, auditor, ama_officer, ama_head see all enterprise requests relevant to asset governance

    const { data: requests, error } = await query
    if (error) throw error
    if (!requests || requests.length === 0) return []

    const reqIds = requests.map(r => r.id).filter(Boolean)

    let itemsMap = {}
    let tasksMap = {}
    let auditMap = {}

    if (reqIds.length > 0) {
      try {
        const [itemsRes, tasksRes, auditRes] = await Promise.all([
          supabase.from('movement_items').select('*').in('movement_request_id', reqIds),
          supabase.from('transport_tasks').select('*').in('movement_request_id', reqIds),
          supabase.from('audit_log').select('*').in('movement_request_id', reqIds)
        ])

        ;(itemsRes.data || []).forEach(it => {
          if (!itemsMap[it.movement_request_id]) itemsMap[it.movement_request_id] = []
          itemsMap[it.movement_request_id].push(it)
        })

        ;(tasksRes.data || []).forEach(t => {
          tasksMap[t.movement_request_id] = t
        })

        ;(auditRes.data || []).forEach(a => {
          if (!auditMap[a.movement_request_id]) auditMap[a.movement_request_id] = []
          auditMap[a.movement_request_id].push(a)
        })
      } catch (err) {
        console.warn('[Supabase getRequests] Related tables fetch error, continuing with base records:', err)
      }
    }

    const names = await getNameMap(supabase)
    return requests.map(r => {
      const combined = {
        ...r,
        items: itemsMap[r.id] || [],
        transport_task: tasksMap[r.id] || null,
        audit_log: auditMap[r.id] || []
      }
      return populateRequestRecord(combined, names)
    })
  },

  async getRequestById(id) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const { data: request, error } = await supabase
      .from('movement_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!request) return null

    let items = []
    let task = null
    let auditLog = []

    try {
      const [itemsRes, taskRes, auditRes] = await Promise.all([
        supabase.from('movement_items').select('*').eq('movement_request_id', id),
        supabase.from('transport_tasks').select('*').eq('movement_request_id', id).maybeSingle(),
        supabase.from('audit_log').select('*').eq('movement_request_id', id).order('created_at', { ascending: true })
      ])

      items = itemsRes.data || []
      task = taskRes.data || null
      auditLog = auditRes.data || []
    } catch (err) {
      console.warn('[Supabase getRequestById] Related tables fetch error:', err)
    }

    const combined = {
      ...request,
      items,
      transport_task: task,
      audit_log: auditLog
    }

    return populateRequestRecord(combined, await getNameMap(supabase))
  },

  async createRequest(payload, user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    // reference_no, requesting officer and initial status are set by the
    // database (see movement_request_before_insert in supabase_schema.sql).
    const { items = [], ...formData } = payload
    const userId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null

    // The requester chooses Transport or IT explicitly on the form.
    const resolvedFulfillment = formData.fulfillment_type === 'it' ? 'it' : 'transport'

    // 1. Insert Movement Request
    const insertPayload = {
      requesting_officer_id: userId,
      requesting_officer_staff_id: formData.requesting_officer_staff_id || user?.staff_id || null,
      present_location: formData.present_location,
      new_location: formData.new_location,
      purpose: formData.purpose,
      fulfillment_type: resolvedFulfillment,
      officer_doing_movement: formData.officer_doing_movement || user?.name || '',
      officer_doing_movement_staff_id: formData.officer_doing_movement_staff_id || null,
      authorized_by: formData.authorized_by || null,
      authorized_by_staff_id: formData.authorized_by_staff_id || null,
      department: formData.department || user?.department || '',
      unit: formData.unit || null,
      movement_date: formData.movement_date || new Date().toISOString().split('T')[0],
      priority: formData.priority || 'Normal',
      signature_requester: formData.signature_requester || user?.name || '',
      status: 'pending_head'
    }

    let { data: request, error: reqError } = await supabase
      .from('movement_requests')
      .insert(insertPayload)
      .select()
      .single()

    // Resilient fallbacks if schema differs or FK user ID is no longer in public.users
    if (reqError && (reqError.code === '23503' || reqError.message?.includes('foreign key'))) {
      insertPayload.requesting_officer_id = null
      const retryRes = await supabase
        .from('movement_requests')
        .insert(insertPayload)
        .select()
        .single()
      request = retryRes.data
      reqError = retryRes.error
    }

    if (reqError && (reqError.message?.includes('fulfillment_type') || reqError.code === 'PGRST204')) {
      delete insertPayload.fulfillment_type
      const retryRes = await supabase
        .from('movement_requests')
        .insert(insertPayload)
        .select()
        .single()
      request = retryRes.data
      reqError = retryRes.error
    }

    if (reqError) throw reqError

    // 2. Insert Asset Schedule Items
    if (items.length > 0) {
      const itemsToInsert = items.map((it, idx) => ({
        movement_request_id: request.id,
        item_no: it.item_no || idx + 1,
        name_of_asset: it.name_of_asset,
        asset_code: it.asset_code || ''
      }))

      const { error: itemError } = await supabase
        .from('movement_items')
        .insert(itemsToInsert)

      if (itemError) throw itemError
    }

    // 3. Log Audit
    try {
      await supabase.from('audit_log').insert({
        movement_request_id: request.id,
        action: 'REQUEST_SUBMITTED',
        performed_by: userId && !isNaN(Number(userId)) ? Number(userId) : null,
        performed_by_name: user?.name || 'Requesting Officer',
        remarks: `Movement request submitted with ${items.length} asset item(s)`
      })
    } catch (auditErr) {
      console.warn('[createRequest audit log warning]', auditErr)
    }

    // 4. Delete user's draft upon successful submission
    try {
      await this.deleteDraft(userId)
    } catch (_) {}

    return this.getRequestById(request.id)
  },

  async approveRequest(id, remarks, user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const request = await this.getRequestById(id)
    if (!request) throw new Error('Request not found')

    const now = new Date().toISOString()
    const numericUserId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null
    const updates = {}
    let auditAction = ''

    if (request.status === 'pending_head') {
      updates.status = 'head_approved'
      updates.head_approved_by = numericUserId
      updates.head_approved_name = user?.name || 'Unit Head'
      updates.head_approved_at = now
      updates.head_remarks = remarks || null
      updates.head_signature = user?.name || 'Signed Electronically'
      auditAction = 'HEAD_APPROVED'
    } else if (request.status === 'head_approved') {
      updates.status = 'ama_officer_approved'
      updates.ama_officer_approved_by = numericUserId
      updates.ama_officer_name = user?.name || 'Asset & Archives Pool'
      updates.ama_officer_approved_at = now
      updates.ama_officer_remarks = remarks || null
      updates.ama_officer_signature = user?.name || 'Verified Electronically'
      auditAction = 'ASSET_VERIFIED_BY_AMA_POOL'
    } else if (request.status === 'ama_officer_approved') {
      updates.status = 'fully_approved'
      updates.ama_head_approved_by = numericUserId
      updates.ama_head_name = user?.name || 'Asset & Archives Pool'
      updates.ama_head_signature = user?.name || 'Authorized Electronically'
      updates.ama_head_approved_at = now
      updates.ama_head_remarks = remarks || null
      auditAction = 'FINAL_AUTHORIZATION_BY_AMA_POOL'

      // The Transport / IT fulfillment task is created by the database when
      // the status becomes fully_approved (movement_request_after_update).
    }

    let { error } = await supabase
      .from('movement_requests')
      .update(updates)
      .eq('id', id)

    // Fallback if custom columns don't exist in Supabase schema or FK constraint triggers
    if (error) {
      const safeUpdates = {
        status: updates.status,
        head_approved_at: updates.head_approved_at,
        head_remarks: updates.head_remarks,
        head_signature: updates.head_signature,
        head_approved_name: updates.head_approved_name,
        ama_officer_approved_at: updates.ama_officer_approved_at,
        ama_officer_remarks: updates.ama_officer_remarks,
        ama_officer_name: updates.ama_officer_name,
        ama_head_name: updates.ama_head_name,
        ama_head_signature: updates.ama_head_signature,
        ama_head_approved_at: updates.ama_head_approved_at,
        ama_head_remarks: updates.ama_head_remarks
      }
      Object.keys(safeUpdates).forEach(k => safeUpdates[k] === undefined && delete safeUpdates[k])
      const retryRes = await supabase.from('movement_requests').update(safeUpdates).eq('id', id)
      error = retryRes.error
    }

    if (error) throw error
    await assertStatus(supabase, 'movement_requests', id, updates.status)

    try {
      await supabase.from('audit_log').insert({
        movement_request_id: Number(id),
        action: auditAction || 'STATUS_UPDATED',
        performed_by: numericUserId,
        performed_by_name: user?.name || null,
        remarks: remarks || null
      })
    } catch (auditErr) {
      console.warn('[approveRequest audit log warning]', auditErr)
    }

    return this.getRequestById(id)
  },

  async rejectRequest(id, remarks, user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const { error } = await supabase
      .from('movement_requests')
      .update({
        status: 'rejected',
        rejection_remarks: remarks
      })
      .eq('id', id)

    if (error) throw error
    await assertStatus(supabase, 'movement_requests', id, 'rejected')

    const numericUserId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null
    try {
      await supabase.from('audit_log').insert({
        movement_request_id: Number(id),
        action: 'REQUEST_REJECTED',
        performed_by: numericUserId,
        performed_by_name: user?.name || 'Reviewer',
        remarks
      })
    } catch (auditErr) {
      console.warn('[rejectRequest audit log warning]', auditErr)
    }

    return this.getRequestById(id)
  },

  async closeRequest(id, remarks, user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const now = new Date().toISOString()
    const numericUserId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null

    let { error } = await supabase
      .from('movement_requests')
      .update({
        status: 'closed',
        ama_closed_by: numericUserId,
        ama_closed_name: user?.name || 'Asset & Archives Pool',
        ama_closed_at: now,
        ama_closing_remarks: remarks || null
      })
      .eq('id', id)

    if (error) {
      const retryRes = await supabase
        .from('movement_requests')
        .update({
          status: 'closed',
          ama_closed_name: user?.name || 'Asset & Archives Pool',
          ama_closed_at: now,
          ama_closing_remarks: remarks || null
        })
        .eq('id', id)
      error = retryRes.error
    }

    if (error) throw error
    await assertStatus(supabase, 'movement_requests', id, 'closed')

    try {
      await supabase.from('audit_log').insert({
        movement_request_id: Number(id),
        action: 'REGISTER_UPDATED_AND_CLOSED_BY_AMA_POOL',
        performed_by: numericUserId,
        performed_by_name: user?.name || null,
        remarks: remarks || null
      })
    } catch (auditErr) {
      console.warn('[closeRequest audit log warning]', auditErr)
    }

    return this.getRequestById(id)
  },

  // ── DRAFTS (Strictly 1 draft per user) ──────────────────────────────────────
  async getDraft(userId) {
    const supabase = getSupabase()
    if (!supabase) return null

    const { data, error } = await supabase
      .from('drafts')
      .select('*')
      .eq('user_id', String(userId))
      .maybeSingle()

    if (error || !data) return null
    return data
  },

  async saveDraft(userId, draftData) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const payload = {
      user_id: String(userId),
      form: draftData.form || {},
      items: draftData.items || [],
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('drafts')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteDraft(userId) {
    const supabase = getSupabase()
    if (!supabase) return true

    await supabase
      .from('drafts')
      .delete()
      .eq('user_id', String(userId))

    return true
  },

  // ── FULFILLMENT & LOGISTICS (TRANSPORT & IT INFRASTRUCTURE) ────────────────
  async getTransportTasks(user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const role = user?.role
    const isAdmin = role === 'admin' || role === 'auditor'
    const isTransport = role === 'transport_head' || role === 'transport_officer'
    const isIt = role === 'it_head' || role === 'it_officer'

    let query = supabase
      .from('transport_tasks')
      .select(`
        *,
        request:movement_requests(
          id, reference_no, present_location, new_location, purpose, status
        )
      `)
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      if (isTransport && !isIt) {
        query = query.neq('fulfillment_type', 'it')
      } else if (isIt && !isTransport) {
        query = query.eq('fulfillment_type', 'it')
      }
    }

    const { data, error } = await query

    if (error) throw error

    // Fetch items for each
    const reqIds = (data || []).map(t => t.movement_request_id).filter(Boolean)
    let itemsMap = {}
    if (reqIds.length > 0) {
      const { data: allItems } = await supabase
        .from('movement_items')
        .select('*')
        .in('movement_request_id', reqIds)
      
      allItems?.forEach(it => {
        if (!itemsMap[it.movement_request_id]) itemsMap[it.movement_request_id] = []
        itemsMap[it.movement_request_id].push(it)
      })
    }

    const names = await getNameMap(supabase)
    return (data || []).map(t => {
      const populated = populateTaskRecord(t)
      return {
        ...populated,
        request: populateRequestRecord(t.request, names),
        items: itemsMap[t.movement_request_id] || []
      }
    })
  },

  async getTransportTaskById(id) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const { data, error } = await supabase
      .from('transport_tasks')
      .select(`
        *,
        request:movement_requests(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return null

    const { data: items } = await supabase
      .from('movement_items')
      .select('*')
      .eq('movement_request_id', data.movement_request_id)

    const populated = populateTaskRecord(data)
    return {
      ...populated,
      request: populateRequestRecord(data.request, await getNameMap(supabase)),
      items: items || []
    }
  },

  async getUsers(query = '') {
    const supabase = getSupabase()
    if (!supabase) return []
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, department, staff_id')
        .order('name', { ascending: true })
      if (error) throw error
      if (!data) return []
      const q = (query || '').trim().toLowerCase()
      if (!q) return data
      return data.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.staff_id || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q)
      )
    } catch (err) {
      console.warn('[getUsers warning]', err)
      return []
    }
  },

  async createUser(userData) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')
    const trimmedEmail = (userData.email || '').trim().toLowerCase()
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .ilike('email', trimmedEmail)
      .maybeSingle()
    if (existing) {
      throw new Error('A user with this email already exists.')
    }
    // Pre-registration only: the person activates it by signing up with this
    // email (Supabase Auth). Passwords are never stored in this table.
    const payload = {
      name: (userData.name || '').trim(),
      email: trimmedEmail,
      role: userData.role || 'requesting_officer',
      department: (userData.department || '').trim() || 'Operations',
      staff_id: (userData.staff_id || '').trim() || null
    }
    const { data, error } = await supabase
      .from('users')
      .insert(payload)
      .select('id, name, email, role, department, staff_id')
      .single()
    if (error) throw error
    return data
  },

  async updateUser(id, changes) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')
    const payload = {}
    for (const k of ['name', 'role', 'department', 'staff_id']) {
      if (changes[k] !== undefined) payload[k] = typeof changes[k] === 'string' ? changes[k].trim() || null : changes[k]
    }
    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', Number(id))
      .select('id, name, email, role, department, staff_id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('You are not allowed to change this user.')
    nameCache.at = 0
    return data[0]
  },

  async deleteUser(id) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')
    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('id', Number(id))
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('You are not allowed to remove this user.')
    nameCache.at = 0
    return true
  },

  async getFulfillmentOfficers(isIt = false) {
    const users = await this.getUsers()
    if (!users || users.length === 0) return []
    // Administrators can also be assigned (e.g. a single-admin demo).
    const pool = isIt ? ['it_head', 'it_officer'] : ['transport_head', 'transport_officer']
    return users
      .filter(u => pool.includes(u.role) || u.role === 'admin')
      .sort((a, b) => (a.role === 'admin') - (b.role === 'admin'))
  },

  async assignTransport(id, assignData, user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const rawId = assignData.assigned_officer_id
    const numericOfficerId = (rawId !== null && rawId !== undefined && String(rawId).trim() !== '' && !isNaN(Number(rawId)) && Number(rawId) > 0)
      ? Number(rawId)
      : null
    const officerName = assignData.assigned_officer_name?.trim() || null
    const driverName = assignData.driver_name?.trim() || null

    const payload = {
      assigned_officer_id: numericOfficerId,
      assigned_officer_name: officerName,
      vehicle_details: assignData.vehicle_details?.trim() || null,
      driver_name: driverName,
      scheduled_date: assignData.scheduled_date,
      assessment_notes: assignData.assessment_notes?.trim() || null,
      assignment_notes: assignData.assignment_notes?.trim() || null,
      status: 'officer_assigned'
    }

    let { error } = await supabase
      .from('transport_tasks')
      .update(payload)
      .eq('id', id)

    // Fallback if driver_name or assigned_officer_name columns don't exist yet in Supabase schema
    if (error && (error.message?.includes('driver_') || error.message?.includes('assigned_officer_name'))) {
      const basicPayload = {
        assigned_officer_id: numericOfficerId,
        vehicle_details: assignData.vehicle_details?.trim(),
        scheduled_date: assignData.scheduled_date,
        assessment_notes: assignData.assessment_notes?.trim() || null,
        assignment_notes: `Assigned: ${officerName}. Driver: ${driverName || 'Officer / Contractor'}. ${assignData.assignment_notes || ''}`.trim(),
        status: 'officer_assigned'
      }
      const retryRes = await supabase
        .from('transport_tasks')
        .update(basicPayload)
        .eq('id', id)
      error = retryRes.error
    }

    if (error) throw error
    await assertStatus(supabase, 'transport_tasks', id, 'officer_assigned')

    // Add Audit Log
    const currentTask = await this.getTransportTaskById(id)
    if (currentTask?.movement_request_id) {
      const isIt = currentTask.fulfillment_type === 'it' || currentTask.request?.fulfillment_type === 'it'
      const numericUserId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null
      try {
        await supabase.from('audit_log').insert({
          movement_request_id: Number(currentTask.movement_request_id),
          transport_task_id: Number(id),
          action: isIt ? 'IT_OFFICER_ASSIGNED' : 'OFFICER_ASSIGNED',
          performed_by: numericUserId,
          performed_by_name: user?.name || null,
          remarks: isIt
            ? `Assigned: ${officerName}. Carrier/Equipment: ${assignData.vehicle_details || 'IT Transport Van'}${driverName ? ` • Driver/Courier: ${driverName}` : ''}. Date: ${assignData.scheduled_date}`
            : `Assigned: ${officerName}. Vehicle: ${assignData.vehicle_details}${driverName ? ` • Driver: ${driverName}` : ''}. Date: ${assignData.scheduled_date}`
        })
      } catch (auditErr) {
        console.warn('[assignTransport audit log warning]', auditErr)
      }
    }

    return this.getTransportTaskById(id)
  },

  async startTransport(id, user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const task = await this.getTransportTaskById(id)
    if (!task) throw new Error('Task not found')

    const isItTask = task.fulfillment_type === 'it' || task.request?.fulfillment_type === 'it'
    const numericUserId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null

    // 1. Update transport_tasks status to in_progress
    const { error: taskError } = await supabase
      .from('transport_tasks')
      .update({ status: 'in_progress' })
      .eq('id', id)

    if (taskError) {
      console.error('[startTransport error]', taskError)
      throw new Error(taskError.message || 'Failed to update transport task status.')
    }
    await assertStatus(supabase, 'transport_tasks', id, 'in_progress')

    // 2. Update parent movement_request status to in_transport
    const { error: reqError } = await supabase
      .from('movement_requests')
      .update({ status: 'in_transport' })
      .eq('id', task.movement_request_id)

    if (reqError) {
      console.warn('[startTransport request update warning]', reqError)
    }

    // 3. Add to audit log
    try {
      await supabase.from('audit_log').insert({
        movement_request_id: Number(task.movement_request_id),
        transport_task_id: Number(id),
        action: isItTask ? 'IT_EQUIPMENT_PICKUP_STARTED' : 'TRANSPORT_STARTED_BY_POOL',
        performed_by: numericUserId,
        performed_by_name: user?.name || null,
        remarks: null
      })
    } catch (err) {
      console.warn('[startTransport audit_log warning]', err)
    }

    return this.getTransportTaskById(id)
  },

  async completeTransport(id, completionNotes, user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const task = await this.getTransportTaskById(id)
    if (!task) throw new Error('Task not found')

    const isItTask = task.fulfillment_type === 'it' || task.request?.fulfillment_type === 'it'
    const numericUserId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null

    const now = new Date().toISOString()
    const { error: taskError } = await supabase
      .from('transport_tasks')
      .update({
        status: 'completed',
        completed_at: now,
        completion_notes: completionNotes?.trim() || null
      })
      .eq('id', id)

    if (taskError) {
      console.error('[completeTransport error]', taskError)
      throw new Error(taskError.message || 'Failed to complete transport task.')
    }
    await assertStatus(supabase, 'transport_tasks', id, 'completed')

    // Update parent movement_request to transport_completed
    const { error: reqError } = await supabase
      .from('movement_requests')
      .update({ status: 'transport_completed' })
      .eq('id', task.movement_request_id)

    if (reqError) {
      console.warn('[completeTransport request update warning]', reqError)
    }

    try {
      await supabase.from('audit_log').insert({
        movement_request_id: Number(task.movement_request_id),
        transport_task_id: Number(id),
        action: isItTask ? 'IT_RELOCATION_COMPLETED' : 'RELOCATION_COMPLETED_BY_TRANSPORT_POOL',
        performed_by: numericUserId,
        performed_by_name: user?.name || null,
        remarks: completionNotes?.trim() || null
      })
    } catch (auditErr) {
      console.warn('[completeTransport audit log warning]', auditErr)
    }

    return this.getTransportTaskById(id)
  }
}

