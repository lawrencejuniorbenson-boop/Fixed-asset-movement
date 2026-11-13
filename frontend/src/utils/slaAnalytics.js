/**
 * frontend/src/utils/slaAnalytics.js
 * Comprehensive SLA & Stage Pending Duration Analytics Engine for Fixed Asset Movement.
 * Calculates exact pending duration for each stage of the lifecycle and tracks SLA adherence.
 */

export const STAGE_SLAS = {
  head_review: {
    name: 'Stage 1: Requesting Department Head Review & Approval',
    shortName: 'Unit Head Review',
    role: 'Requesting Department Head',
    pool: 'Requesting Department',
    targetHours: 24
  },
  ama_verification_and_auth: {
    name: 'Stage 2: Asset Register Verification & Movement Authorization',
    shortName: 'Asset Verification & Authorization',
    role: 'Asset Management & Archives Department',
    pool: 'Asset Management & Archives Department',
    targetHours: 24
  },
  transport_allocation: {
    name: 'Stage 3: Logistics & Fulfillment Allocation',
    shortName: 'Fulfillment Allocation',
    role: 'Fulfillment Department Pool',
    pool: 'Transport & Logistics / IT Infrastructure',
    targetHours: 24
  },
  transport_execution: {
    name: 'Stage 4: Physical Transit & Logistics Relocation',
    shortName: 'Relocation Transit',
    role: 'Fulfillment Department Pool',
    pool: 'Transport & Logistics / IT Infrastructure',
    targetHours: 48
  },
  register_closure: {
    name: 'Stage 5: Asset Register Update & Record Archival',
    shortName: 'Register Closure',
    role: 'Asset Management & Archives Department',
    pool: 'Asset Management & Archives Department',
    targetHours: 24
  }
}

/**
 * Formats milliseconds into human-readable duration
 * e.g. "1h 45m", "2d 4h", "14 mins", "< 1 min"
 */
export function formatDuration(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '—'
  if (ms < 0) ms = 0

  const totalMinutes = Math.floor(ms / (1000 * 60))
  const totalHours = Math.floor(totalMinutes / 60)
  const totalDays = Math.floor(totalHours / 24)

  if (totalDays > 0) {
    const remHours = totalHours % 24
    return remHours > 0 ? `${totalDays}d ${remHours}h` : `${totalDays} day${totalDays > 1 ? 's' : ''}`
  }

  if (totalHours > 0) {
    const remMinutes = totalMinutes % 60
    return remMinutes > 0 ? `${totalHours}h ${remMinutes}m` : `${totalHours} hour${totalHours > 1 ? 's' : ''}`
  }

  if (totalMinutes > 0) {
    return `${totalMinutes} min${totalMinutes > 1 ? 's' : ''}`
  }

  return '< 1 min'
}

/**
 * Calculates stage durations and pending SLA analytics for a given movement request
 */
export function calculateStageDurations(request, auditLog = []) {
  if (!request) return null

  const now = new Date()
  const logs = Array.isArray(auditLog) ? auditLog : (request.audit_log || [])
  const task = request.transport_task || null

  // Helpers to find specific audit events
  const findLog = (actionName) => {
    return logs.find(l => (l.action || '').toUpperCase() === actionName.toUpperCase())
  }

  const findLogAfter = (actionName, minTime) => {
    return logs.find(l => {
      const isAction = (l.action || '').toUpperCase() === actionName.toUpperCase()
      if (!isAction) return false
      if (!minTime) return true
      return new Date(l.created_at).getTime() >= new Date(minTime).getTime()
    })
  }

  const createdAt = request.created_at ? new Date(request.created_at) : null
  const headApprovedAt = request.head_approved_at ? new Date(request.head_approved_at) : null
  const amaOfficerApprovedAt = request.ama_officer_approved_at ? new Date(request.ama_officer_approved_at) : null
  const amaHeadApprovedAt = request.ama_head_approved_at ? new Date(request.ama_head_approved_at) : null

  // Transport assigned time (from audit log or task creation if assigned)
  const officerAssignedLog = findLog('OFFICER_ASSIGNED')
  let transportAssignedAt = null
  if (task && (task.assigned_officer_id || task.assigned_officer_name || task.vehicle_details)) {
    if (officerAssignedLog) {
      transportAssignedAt = new Date(officerAssignedLog.created_at)
    } else if (task.created_at) {
      transportAssignedAt = new Date(task.created_at)
    }
  }

  // Transport started time
  const transportStartedLog = findLog('TRANSPORT_STARTED')
  const transportStartedAt = transportStartedLog ? new Date(transportStartedLog.created_at) : (request.status === 'in_transport' ? (transportAssignedAt || now) : null)

  // Transport completed time
  const transportCompletedAt = task?.completed_at ? new Date(task.completed_at) : (findLog('TRANSPORT_COMPLETED_AMA_NOTIFIED')?.created_at ? new Date(findLog('TRANSPORT_COMPLETED_AMA_NOTIFIED').created_at) : null)

  // AMA closed time
  const amaClosedAt = request.ama_closed_at ? new Date(request.ama_closed_at) : (findLog('REGISTER_UPDATED_AND_CLOSED')?.created_at ? new Date(findLog('REGISTER_UPDATED_AND_CLOSED').created_at) : null)

  const isRejected = request.status === 'rejected'

  // ── 1. STAGE 1: Unit Head Review ──────────────────────────────────────────
  let stage1State = 'not_reached'
  let stage1DurationMs = null
  if (createdAt) {
    if (headApprovedAt) {
      stage1State = 'completed'
      stage1DurationMs = Math.max(0, headApprovedAt.getTime() - createdAt.getTime())
    } else if (isRejected) {
      stage1State = 'rejected'
      const rejectLog = findLog('REQUEST_REJECTED')
      stage1DurationMs = rejectLog ? Math.max(0, new Date(rejectLog.created_at).getTime() - createdAt.getTime()) : null
    } else if (request.status === 'pending_head') {
      stage1State = 'currently_pending'
      stage1DurationMs = Math.max(0, now.getTime() - createdAt.getTime())
    }
  }

  // ── 2. STAGE 2: AMA Pool — Verification & Authorization (combined) ──────────
  let stage2State = 'not_reached'
  let stage2DurationMs = null
  // Combined: starts when head approves, ends when ama_head_approved (fully_approved)
  if (headApprovedAt) {
    if (amaHeadApprovedAt) {
      stage2State = 'completed'
      stage2DurationMs = Math.max(0, amaHeadApprovedAt.getTime() - headApprovedAt.getTime())
    } else if (isRejected) {
      stage2State = 'rejected'
      const rejectLog = findLog('REQUEST_REJECTED')
      stage2DurationMs = rejectLog ? Math.max(0, new Date(rejectLog.created_at).getTime() - headApprovedAt.getTime()) : null
    } else if (request.status === 'head_approved') {
      stage2State = 'currently_pending'
      stage2DurationMs = Math.max(0, now.getTime() - headApprovedAt.getTime())
    }
  }

  // ── 3. STAGE 3: Fulfillment Logistics Allocation ──────────────────────────────
  let stage4State = 'not_reached'
  let stage4DurationMs = null
  if (amaHeadApprovedAt) {
    if (transportAssignedAt) {
      stage4State = 'completed'
      stage4DurationMs = Math.max(0, transportAssignedAt.getTime() - amaHeadApprovedAt.getTime())
    } else if (request.status === 'fully_approved') {
      stage4State = 'currently_pending'
      stage4DurationMs = Math.max(0, now.getTime() - amaHeadApprovedAt.getTime())
    }
  }

  // ── 5. STAGE 5: Physical Transit & Relocation ──────────────────────────────
  let stage5State = 'not_reached'
  let stage5DurationMs = null
  const transitStartTime = transportStartedAt || transportAssignedAt
  if (transitStartTime) {
    if (transportCompletedAt) {
      stage5State = 'completed'
      stage5DurationMs = Math.max(0, transportCompletedAt.getTime() - transitStartTime.getTime())
    } else if (request.status === 'in_transport') {
      stage5State = 'currently_pending'
      stage5DurationMs = Math.max(0, now.getTime() - transitStartTime.getTime())
    }
  }

  // ── 6. STAGE 6: Register Closure & Records ─────────────────────────────────
  let stage6State = 'not_reached'
  let stage6DurationMs = null
  if (transportCompletedAt) {
    if (amaClosedAt) {
      stage6State = 'completed'
      stage6DurationMs = Math.max(0, amaClosedAt.getTime() - transportCompletedAt.getTime())
    } else if (request.status === 'transport_completed') {
      stage6State = 'currently_pending'
      stage6DurationMs = Math.max(0, now.getTime() - transportCompletedAt.getTime())
    }
  }

  const isIt = request.fulfillment_type === 'it' || task?.fulfillment_type === 'it'
  const fulfillmentDept = isIt ? 'IT Infrastructure & Systems Department' : 'Transport & Logistics Department'
  const fulfillmentShort = isIt ? 'IT Systems Department' : 'Transport & Logistics Department'

  // Build structured stages array — 5 stages (AMA verification & authorization combined)
  const stages = [
    {
      id: 'head_review',
      title: 'Requesting Department Head Review & Approval',
      shortTitle: 'Requesting Department Head',
      actor: request.head_approver_name || 'Department Head',
      role: 'Requesting Department Head',
      state: stage1State,
      startTime: createdAt,
      endTime: headApprovedAt,
      durationMs: stage1DurationMs,
      durationFormatted: formatDuration(stage1DurationMs),
      targetHours: STAGE_SLAS.head_review.targetHours,
      notes: request.head_remarks
    },
    {
      id: 'ama_verification_and_auth',
      title: 'Asset Register Verification & Movement Authorization',
      shortTitle: 'Asset Management & Archives Department',
      actor: request.ama_head_name || request.ama_officer_name || 'AMA pool',
      role: 'Asset Management & Archives Department Pool',
      state: stage2State,
      startTime: headApprovedAt,
      endTime: amaHeadApprovedAt,
      durationMs: stage2DurationMs,
      durationFormatted: formatDuration(stage2DurationMs),
      targetHours: STAGE_SLAS.ama_verification_and_auth.targetHours,
      notes: request.ama_head_remarks || request.ama_officer_remarks
    },
    {
      id: 'transport_allocation',
      title: isIt ? 'IT Logistics & Equipment Allocation' : 'Transport & Logistics Allocation',
      shortTitle: fulfillmentShort,
      actor: fulfillmentDept,
      role: `${fulfillmentDept} Pool`,
      state: stage4State,
      startTime: amaHeadApprovedAt,
      endTime: transportAssignedAt,
      durationMs: stage4DurationMs,
      durationFormatted: formatDuration(stage4DurationMs),
      targetHours: STAGE_SLAS.transport_allocation.targetHours,
      notes: task ? `Department Pool: ${fulfillmentDept} • Carrier/Vehicle: ${task.vehicle_details || 'Pending assignment'}` : null
    },
    {
      id: 'transport_execution',
      title: isIt ? 'Hardware Pickup & Transit Move' : 'Physical Relocation & Asset Move',
      shortTitle: fulfillmentShort,
      actor: fulfillmentDept,
      role: `${fulfillmentDept} Pool`,
      state: stage5State,
      startTime: transitStartTime,
      endTime: transportCompletedAt,
      durationMs: stage5DurationMs,
      durationFormatted: formatDuration(stage5DurationMs),
      targetHours: STAGE_SLAS.transport_execution.targetHours,
      notes: task?.completion_notes
    },
    {
      id: 'register_closure',
      title: 'Fixed Asset Register Closure',
      shortTitle: 'Asset Management & Archives Department',
      actor: 'Asset Management & Archives Department',
      role: 'Asset Management & Archives Department Pool',
      state: stage6State,
      startTime: transportCompletedAt,
      endTime: amaClosedAt,
      durationMs: stage6DurationMs,
      durationFormatted: formatDuration(stage6DurationMs),
      targetHours: STAGE_SLAS.register_closure.targetHours,
      notes: request.ama_closing_remarks
    }
  ]

  // Total Turnaround Time (TAT)
  const isClosed = request.status === 'closed'
  const finalTime = isClosed && amaClosedAt ? amaClosedAt : now
  const totalDurationMs = createdAt ? Math.max(0, finalTime.getTime() - createdAt.getTime()) : 0

  // Find currently active stage (the stage currently pending)
  const currentStage = stages.find(s => s.state === 'currently_pending') || null

  // Find slowest / longest stage among completed or active
  const activeOrDoneStages = stages.filter(s => s.durationMs !== null && s.durationMs > 0)
  let slowestStage = null
  if (activeOrDoneStages.length > 0) {
    slowestStage = activeOrDoneStages.reduce((prev, curr) => (curr.durationMs > prev.durationMs ? curr : prev), activeOrDoneStages[0])
  }

  // Count completed stages
  const completedCount = stages.filter(s => s.state === 'completed').length

  return {
    reference_no: request.reference_no,
    status: request.status,
    createdAt,
    closedAt: amaClosedAt,
    isClosed,
    isRejected,
    totalDurationMs,
    totalDurationFormatted: formatDuration(totalDurationMs),
    currentStage,
    currentStagePendingFormatted: currentStage ? currentStage.durationFormatted : null,
    slowestStage,
    completedCount,
    totalStages: stages.length,
    stages,
    auditLogs: logs
  }
}

