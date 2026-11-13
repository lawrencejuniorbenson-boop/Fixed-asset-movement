/**
 * frontend/src/services/supabaseDataService.js
 * Comprehensive Direct-to-Supabase backend operations.
 * Allows the frontend to run 100% serverless against Supabase Cloud.
 */

import { getSupabase } from '../lib/supabase'

export const CORPORATE_STAFF_MAP = {}

export function resolveStaff(idOrEmail) {
  if (!idOrEmail) return null
  const num = Number(idOrEmail)
  if (CORPORATE_STAFF_MAP[num]) return CORPORATE_STAFF_MAP[num]
  const str = String(idOrEmail).toLowerCase()
  return Object.values(CORPORATE_STAFF_MAP).find(s => 
    s.email.toLowerCase() === str || s.staff_id.toLowerCase() === str || s.name.toLowerCase() === str
  ) || null
}

export function populateTaskRecord(t) {
  if (!t) return null
  const isIt = t.fulfillment_type === 'it'
  let officerName = t.assigned_officer_name
  if (!officerName || officerName === 'Transport Officer' || officerName === 'IT Specialist') {
    const s = resolveStaff(t.assigned_officer_id)
    if (s) officerName = s.name
    else if (t.assignment_notes && t.assignment_notes.includes('Assigned:')) {
      const m = t.assignment_notes.match(/Assigned:\s*([^.]+)/)
      if (m) officerName = m[1].trim()
    } else {
      officerName = isIt ? 'IT Logistics Officer' : 'Transport Pool Officer'
    }
  }

  const transportHead = resolveStaff(t.transport_head_id)
  const defaultHead = isIt ? 'IT Infrastructure Head' : 'Transport Pool Head'

  return {
    ...t,
    fulfillment_type: t.fulfillment_type || (isIt ? 'it' : 'transport'),
    assigned_officer_name: officerName,
    transport_head_name: t.transport_head_name || (transportHead ? transportHead.name : defaultHead),
    transport_started_name: t.transport_started_name || (['in_progress', 'completed'].includes(t.status) ? officerName : null),
    transport_completed_name: t.transport_completed_name || (t.status === 'completed' ? officerName : null)
  }
}

export function populateRequestRecord(r) {
  if (!r) return null
  const requester = resolveStaff(r.requesting_officer_id)
  const headApprover = resolveStaff(r.head_approved_by)
  const amaOfficer = resolveStaff(r.ama_officer_approved_by)
  const amaHead = resolveStaff(r.ama_head_approved_by)
  const amaClosed = resolveStaff(r.ama_closed_by)

  const rawTask = Array.isArray(r.transport_task) ? r.transport_task[0] : r.transport_task
  const transportTask = populateTaskRecord(rawTask)

  // Enrich audit log entries so every event shows the officer's real name and pool
  let auditLog = (r.audit_log || []).map(log => {
    let pName = log.performed_by_name
    if (!pName || pName === 'System / Auto' || pName === 'Officer') {
      const s = resolveStaff(log.performed_by)
      if (s) {
        pName = `${s.name} (${s.staff_id} • ${s.department})`
      }
    }
    return {
      ...log,
      performed_by_name: pName || 'Corporate Officer'
    }
  })

  const resolvedRequester = r.requester_name || r.officer_doing_movement || (requester ? requester.name : 'Requesting Officer')
  const resolvedHead = r.head_approved_name || r.authorized_by || (headApprover ? headApprover.name : (r.status !== 'pending_head' ? 'Unit Head' : null))
  const resolvedAmaOfficer = r.ama_officer_name || (amaOfficer ? amaOfficer.name : (!['pending_head', 'head_approved'].includes(r.status) ? 'Asset & Archives Pool' : null))
  const resolvedAmaHead = r.ama_head_name || (amaHead ? amaHead.name : (['fully_approved', 'in_transport', 'transport_completed', 'closed'].includes(r.status) ? 'Asset & Archives Pool' : null))
  const resolvedAmaClosed = r.ama_closed_name || (amaClosed ? amaClosed.name : (r.status === 'closed' ? 'Asset & Archives Pool' : null))
  
  const hasItAssets = (r.items || []).some(i => {
    const n = (i.name_of_asset || '').toLowerCase()
    return n.includes('server') || n.includes('switch') || n.includes('rack') || n.includes('router') || n.includes('ups') || n.includes('cisco') || n.includes('firewall') || n.includes('workstation')
  })
  const isIt = r.fulfillment_type === 'it' || transportTask?.fulfillment_type === 'it' || hasItAssets
  const resolvedFulfillmentHead = isIt ? 'IT Infrastructure Head' : 'Transport Pool Head'
  const resolvedFulfillmentOfficer = transportTask?.assigned_officer_name || (isIt ? 'IT Logistics Officer' : 'Transport Pool Officer')
  const fulfillmentPoolLabel = isIt ? 'IT Infrastructure & Systems Pool' : 'Transport & Logistics Pool'

  // If audit_log is empty in DB for this request, synthesize baseline events from the request's real milestone records
  if (auditLog.length === 0) {
    const createdAt = r.created_at || new Date().toISOString()
    auditLog.push({
      id: `synth-${r.id}-1`,
      movement_request_id: r.id,
      action: 'REQUEST_SUBMITTED',
      created_at: createdAt,
      performed_by_name: `${resolvedRequester} (Requesting Officer)`,
      remarks: `Movement request submitted by ${resolvedRequester} for ${(r.items || []).length} asset item(s).`
    })

    if (r.head_approved_at || r.status !== 'pending_head') {
      auditLog.push({
        id: `synth-${r.id}-2`,
        movement_request_id: r.id,
        action: 'HEAD_APPROVED',
        created_at: r.head_approved_at || createdAt,
        performed_by_name: `${resolvedHead || 'Unit Head'} (Unit Head)`,
        remarks: r.head_remarks || `Departmental endorsement granted.`
      })
    }

    if (r.ama_officer_approved_at || (!['pending_head', 'head_approved'].includes(r.status))) {
      auditLog.push({
        id: `synth-${r.id}-3`,
        movement_request_id: r.id,
        action: 'ASSET_VERIFIED_BY_AMA_POOL',
        created_at: r.ama_officer_approved_at || r.head_approved_at || createdAt,
        performed_by_name: `${resolvedAmaOfficer || 'Asset & Archives Pool'} (Asset & Archives Pool)`,
        remarks: r.ama_officer_remarks || `Asset codes verified.`
      })
    }

    if (r.ama_head_approved_at || (['fully_approved', 'in_transport', 'transport_completed', 'closed'].includes(r.status))) {
      auditLog.push({
        id: `synth-${r.id}-4`,
        movement_request_id: r.id,
        action: 'FINAL_AUTHORIZATION_BY_AMA_POOL',
        created_at: r.ama_head_approved_at || r.ama_officer_approved_at || createdAt,
        performed_by_name: `${resolvedAmaHead || 'Asset & Archives Head'} (Asset & Archives Pool)`,
        remarks: r.ama_head_remarks || `Final movement authorization approved.`
      })
    }

    if (transportTask && transportTask.status !== 'pending_assignment') {
      auditLog.push({
        id: `synth-${r.id}-5`,
        movement_request_id: r.id,
        action: isIt ? 'IT_EQUIPMENT_ALLOCATED' : 'OFFICER_ASSIGNED',
        created_at: transportTask.created_at || r.ama_head_approved_at || createdAt,
        performed_by_name: `${transportTask.transport_head_name || resolvedFulfillmentHead} (${fulfillmentPoolLabel})`,
        remarks: isIt
          ? `IT task assigned: ${resolvedFulfillmentOfficer}. Carrier / Equipment: ${transportTask.vehicle_details || 'IT Designated Van / Hand Trolley'}.`
          : `Assigned: ${resolvedFulfillmentOfficer}. Vehicle: ${transportTask.vehicle_details || 'Toyota Hilux'}.`
      })
    }

    if (['in_transport', 'transport_completed', 'closed'].includes(r.status) || (transportTask && ['in_progress', 'completed'].includes(transportTask.status))) {
      auditLog.push({
        id: `synth-${r.id}-6`,
        movement_request_id: r.id,
        action: isIt ? 'IT_EQUIPMENT_PICKUP_STARTED' : 'TRANSPORT_STARTED_BY_POOL',
        created_at: transportTask?.scheduled_date ? `${transportTask.scheduled_date}T08:00:00Z` : createdAt,
        performed_by_name: `${transportTask?.transport_started_name || resolvedFulfillmentOfficer} (${fulfillmentPoolLabel})`,
        remarks: isIt
          ? `IT hardware and servers de-racked and in physical transit with ${transportTask?.vehicle_details || 'IT Carrier'}.`
          : `Physical relocation in transit with ${transportTask?.vehicle_details || 'carrier'}.`
      })
    }

    if (['transport_completed', 'closed'].includes(r.status) || (transportTask && transportTask.status === 'completed')) {
      auditLog.push({
        id: `synth-${r.id}-7`,
        movement_request_id: r.id,
        action: isIt ? 'IT_RELOCATION_COMPLETED' : 'RELOCATION_COMPLETED_BY_TRANSPORT_POOL',
        created_at: transportTask?.completed_at || createdAt,
        performed_by_name: `${transportTask?.transport_completed_name || resolvedFulfillmentOfficer} (${fulfillmentPoolLabel})`,
        remarks: transportTask?.completion_notes || (isIt
          ? `IT equipment and servers safely delivered, mounted, and connectivity verified by ${resolvedFulfillmentOfficer}.`
          : `Assets physically delivered by ${resolvedFulfillmentOfficer}.`)
      })
    }

    if (r.status === 'closed' || r.ama_closed_at) {
      auditLog.push({
        id: `synth-${r.id}-8`,
        movement_request_id: r.id,
        action: 'REGISTER_UPDATED_AND_CLOSED_BY_AMA_POOL',
        created_at: r.ama_closed_at || createdAt,
        performed_by_name: `${resolvedAmaClosed || 'Asset & Archives Officer'} (Asset & Archives Pool)`,
        remarks: r.ama_closing_remarks || `Asset register updated and request closed.`
      })
    }
  }

  return {
    ...r,
    fulfillment_type: isIt ? 'it' : (r.fulfillment_type || 'transport'),
    requester_name: resolvedRequester,
    requester_department: r.requester_department || r.department || (requester ? requester.department : 'Operations'),
    requester_staff_id: r.requesting_officer_staff_id || (requester ? requester.staff_id : ''),
    head_approver_name: resolvedHead,
    ama_officer_name: resolvedAmaOfficer,
    ama_head_name: resolvedAmaHead,
    ama_closed_name: resolvedAmaClosed,
    items: r.items || [],
    transport_task: transportTask,
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

    return requests.map(r => {
      const combined = {
        ...r,
        items: itemsMap[r.id] || [],
        transport_task: tasksMap[r.id] || null,
        audit_log: auditMap[r.id] || []
      }
      return populateRequestRecord(combined)
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

    return populateRequestRecord(combined)
  },

  async createRequest(payload, user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    // reference_no, requesting officer and initial status are set by the
    // database (see movement_request_before_insert in supabase_schema.sql).
    const { items = [], ...formData } = payload
    const userId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null

    // Detect IT vs Transport fulfillment
    const hasItAssets = items.some(i => {
      const n = (i.name_of_asset || '').toLowerCase()
      return n.includes('server') || n.includes('switch') || n.includes('rack') || n.includes('router') || n.includes('ups') || n.includes('cisco')
    })
    const resolvedFulfillment = formData.fulfillment_type === 'it' || hasItAssets ? 'it' : 'transport'

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
      updates.head_remarks = remarks || 'Departmental approval granted.'
      updates.head_signature = user?.name || 'Signed Electronically'
      auditAction = 'HEAD_APPROVED'
    } else if (request.status === 'head_approved') {
      updates.status = 'ama_officer_approved'
      updates.ama_officer_approved_by = numericUserId
      updates.ama_officer_name = user?.name || 'Asset & Archives Pool'
      updates.ama_officer_approved_at = now
      updates.ama_officer_remarks = remarks || 'Asset codes and register verified.'
      updates.ama_officer_signature = user?.name || 'Verified Electronically'
      auditAction = 'ASSET_VERIFIED_BY_AMA_POOL'
    } else if (request.status === 'ama_officer_approved') {
      updates.status = 'fully_approved'
      updates.ama_head_approved_by = numericUserId
      updates.ama_head_name = user?.name || 'Asset & Archives Pool'
      updates.ama_head_signature = user?.name || 'Authorized Electronically'
      updates.ama_head_approved_at = now
      updates.ama_head_remarks = remarks || 'Final approval granted. Relocation task initiated.'
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
        performed_by_name: `${user?.name || 'Officer'} (Asset & Archives Pool)`,
        remarks: remarks || `Action processed by ${user?.name || 'Asset & Archives Pool'}`
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
        ama_closing_remarks: remarks || 'Asset register updated and file closed.'
      })
      .eq('id', id)

    if (error) {
      const retryRes = await supabase
        .from('movement_requests')
        .update({
          status: 'closed',
          ama_closed_name: user?.name || 'Asset & Archives Pool',
          ama_closed_at: now,
          ama_closing_remarks: remarks || 'Asset register updated and file closed.'
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
        performed_by_name: `${user?.name || 'Officer'} (Asset & Archives Pool)`,
        remarks: remarks || `Fixed asset register updated and request closed by ${user?.name || 'Asset & Archives Pool'}.`
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
    const userDept = user?.department || ''
    const isAdmin = role === 'admin' || role === 'auditor'
    const isTransport = role === 'transport_head' || role === 'transport_officer' || userDept.includes('Transport') || userDept.includes('Logistics') || userDept.includes('Fleet')
    const isIt = role === 'it_head' || role === 'it_officer' || userDept.includes('IT') || userDept.includes('Information')

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

    return (data || []).map(t => {
      const populated = populateTaskRecord(t)
      return {
        ...populated,
        request: populateRequestRecord(t.request),
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
      request: populateRequestRecord(data.request),
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

  async deleteUser(id) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', Number(id))
    if (error) throw error
    return true
  },

  async getFulfillmentOfficers(isIt = false) {
    const users = await this.getUsers()
    if (!users || users.length === 0) return []
    if (isIt) {
      return users.filter(u =>
        u.role === 'it_head' ||
        u.role === 'it_officer' ||
        (u.department && (u.department.toLowerCase().includes('it') || u.department.toLowerCase().includes('information')))
      )
    }
    return users.filter(u =>
      u.role === 'transport_head' ||
      u.role === 'transport_officer' ||
      (u.department && u.department.toLowerCase().includes('transport'))
    )
  },

  async assignTransport(id, assignData, user) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase is not configured')

    const task = await this.getTransportTaskById(id)
    const isItTask = task?.fulfillment_type === 'it' || task?.request?.fulfillment_type === 'it'

    const rawId = assignData.assigned_officer_id
    const numericOfficerId = (rawId !== null && rawId !== undefined && String(rawId).trim() !== '' && !isNaN(Number(rawId)) && Number(rawId) > 0)
      ? Number(rawId)
      : null
    const defaultOfficer = isItTask ? 'IT Logistics Officer' : 'Transport Pool Officer'
    const officerName = assignData.assigned_officer_name?.trim() || defaultOfficer
    const driverName = assignData.driver_name?.trim() || null

    const payload = {
      assigned_officer_id: numericOfficerId,
      assigned_officer_name: officerName,
      vehicle_details: assignData.vehicle_details?.trim() || (isItTask ? 'IT Equipment Transport Van (Anti-Static & Shock Padded)' : 'Transport Vehicle'),
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
      const poolName = isIt ? 'IT Infrastructure & Systems Pool' : 'Transport & Logistics Pool'
      const numericUserId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null
      try {
        await supabase.from('audit_log').insert({
          movement_request_id: Number(currentTask.movement_request_id),
          transport_task_id: Number(id),
          action: isIt ? 'IT_OFFICER_ASSIGNED' : 'OFFICER_ASSIGNED',
          performed_by: numericUserId,
          performed_by_name: `${user?.name || (isIt ? 'IT Infrastructure Head' : 'Transport Pool Head')} (${poolName})`,
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
    const poolName = isItTask ? 'IT Infrastructure & Systems Pool' : 'Transport & Logistics Pool'
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
        performed_by_name: `${user?.name || 'Officer'} (${poolName})`,
        remarks: isItTask
          ? `IT hardware de-racking and transit started by ${user?.name || 'IT Systems Officer'}`
          : `Physical relocation started by ${user?.name || 'Transport Pool Officer'}`
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
    const poolName = isItTask ? 'IT Infrastructure & Systems Pool' : 'Transport & Logistics Pool'
    const numericUserId = user?.id && !isNaN(Number(user.id)) ? Number(user.id) : null

    const now = new Date().toISOString()
    const { error: taskError } = await supabase
      .from('transport_tasks')
      .update({
        status: 'completed',
        completed_at: now,
        completion_notes: completionNotes?.trim() || (isItTask ? 'IT equipment safely relocated, mounted, and connectivity verified at destination.' : 'Assets physically relocated and verified at destination.')
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
        performed_by_name: `${user?.name || 'Officer'} (${poolName})`,
        remarks: isItTask
          ? `IT relocation completed and network verified by ${user?.name || 'IT Systems Officer'}. AMA Pool notified.`
          : `Relocation completed and verified by ${user?.name || 'Transport Pool Officer'}. AMA Pool notified.`
      })
    } catch (auditErr) {
      console.warn('[completeTransport audit log warning]', auditErr)
    }

    return this.getTransportTaskById(id)
  }
}

