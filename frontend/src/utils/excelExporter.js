/**
 * frontend/src/utils/excelExporter.js
 * Excel (.xlsx) Export Utility for Fixed Asset Movement Institutional Audit Logs.
 * Strictly restricted to System Administrators.
 */

import * as XLSX from 'xlsx'
import { formatDuration } from './slaAnalytics'

/**
 * Format a Date object or ISO string nicely for Excel cells
 */
function formatExcelDateTime(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return '—'
    return d.toISOString().replace('T', ' ').substring(0, 19)
  } catch {
    return '—'
  }
}

/**
 * Automatically adjust Excel worksheet column widths based on cell text lengths
 */
function autoFitColumns(ws, data) {
  if (!data || data.length === 0) return
  const colWidths = []
  const keys = Object.keys(data[0] || {})
  
  keys.forEach((key, colIdx) => {
    let maxLen = String(key).length
    data.forEach(row => {
      const val = row[key]
      if (val !== null && val !== undefined) {
        const len = String(val).length
        if (len > maxLen) maxLen = len
      }
    })
    colWidths[colIdx] = { wch: Math.min(Math.max(maxLen + 3, 12), 60) }
  })
  
  ws['!cols'] = colWidths
}

/**
 * EXPORT 1: Single Request Comprehensive Audit Log & SLA Breakdown
 * @param {Object} request - Movement request with items and transport task
 * @param {Object} analytics - Output of calculateStageDurations(request, auditLog)
 * @param {Array} enrichedLogs - Array of chronological audit log entries with elapsed time
 * @param {Object} adminUser - Active user performing export (must be admin)
 */
export function exportSingleRequestAuditToExcel(request, analytics, enrichedLogs = [], adminUser = {}) {
  if (!request) return

  const wb = XLSX.utils.book_new()
  const now = new Date()
  const exportDateStr = now.toISOString().replace('T', ' ').substring(0, 19)

  // ── SHEET 1: Chronological Audit Trail ─────────────────────────────────────
  const auditRows = (enrichedLogs || []).map((log, idx) => ({
    'Event #': idx + 1,
    'Timestamp (UTC)': formatExcelDateTime(log.created_at),
    'Action / Milestone': (log.action || '').replace(/_/g, ' '),
    'Performed By': log.performed_by_name || 'System / Automated',
    'Elapsed Time Since Previous Event': log.elapsedFromPrev || (idx === 0 ? 'Initial Submission' : '< 1 min'),
    'Verification Remarks / Operational Notes': log.remarks || '—'
  }))

  const wsAudit = XLSX.utils.json_to_sheet(auditRows.length > 0 ? auditRows : [{ 'Notice': 'No audit log entries recorded.' }])
  autoFitColumns(wsAudit, auditRows)
  XLSX.utils.book_append_sheet(wb, wsAudit, 'Audit History Trail')

  // ── SHEET 2: Stage-by-Stage Durations & SLA Analytics ──────────────────────
  const stages = analytics?.stages || []
  const stageRows = stages.map((st, idx) => {
    const isCompleted = st.state === 'completed'
    const isPending = st.state === 'currently_pending'
    const targetMs = (st.targetHours || 24) * 3600 * 1000
    let slaStatus = 'NOT REACHED'
    if (st.durationMs !== null) {
      slaStatus = st.durationMs <= targetMs ? 'ON TARGET (WITHIN SLA)' : 'SLA BREACHED (EXCEEDED)'
    }
    if (isPending) {
      slaStatus = st.durationMs <= targetMs ? 'PENDING (CURRENTLY WITHIN SLA)' : 'PENDING (SLA BREACHED)'
    }

    return {
      'Stage #': idx + 1,
      'Stage Lifecycle Phase': st.title,
      'Responsible Pool / Department': st.role,
      'Assigned Department Pool / Approver': st.actor || 'Pending Pool Assignment',
      'Lifecycle State': isCompleted ? 'Completed' : (isPending ? 'Currently Pending' : (st.state === 'rejected' ? 'Rejected' : 'Not Reached')),
      'Target SLA (Hours)': st.targetHours,
      'Actual Time Pended': st.durationFormatted || '—',
      'SLA Compliance Status': slaStatus,
      'Stage Started': formatExcelDateTime(st.startTime),
      'Stage Completed': formatExcelDateTime(st.endTime),
      'Officer Remarks': st.notes || '—'
    }
  })

  const wsStages = XLSX.utils.json_to_sheet(stageRows)
  autoFitColumns(wsStages, stageRows)
  XLSX.utils.book_append_sheet(wb, wsStages, 'Stage SLA & Durations')

  // ── SHEET 3: Request Specification & Metadata ──────────────────────────────
  const metaRows = [
    { 'Attribute': 'System Service', 'Value': 'Fixed Asset Movement Service (Enterprise Bank)' },
    { 'Attribute': 'Request Reference Number', 'Value': request.reference_no || `REQ-${request.id}` },
    { 'Attribute': 'Date Submitted', 'Value': formatExcelDateTime(request.created_at) },
    { 'Attribute': 'Current Lifecycle Status', 'Value': (request.status || '').replace(/_/g, ' ').toUpperCase() },
    { 'Attribute': 'Priority Level', 'Value': request.priority || 'Normal' },
    { 'Attribute': 'Total Turnaround Time (TAT)', 'Value': analytics?.totalDurationFormatted || 'In Progress' },
    { 'Attribute': 'Slowest Bottleneck Phase', 'Value': analytics?.slowestStage ? `${analytics.slowestStage.shortTitle} (${analytics.slowestStage.durationFormatted})` : 'None identified' },
    { 'Attribute': 'Requesting Officer', 'Value': request.requester_name || 'Requesting Officer' },
    { 'Attribute': 'Origin Department', 'Value': request.requester_department || request.department || 'Operations' },
    { 'Attribute': 'Pick-up Location (From)', 'Value': request.present_location || '—' },
    { 'Attribute': 'Destination Location (To)', 'Value': request.new_location || '—' },
    { 'Attribute': 'Scheduled Movement Date', 'Value': request.movement_date || '—' },
    { 'Attribute': 'Purpose of Relocation', 'Value': request.purpose || '—' },
    { 'Attribute': 'Asset Items Count', 'Value': (request.items || []).length },
    { 'Attribute': 'Transport Vehicle Details', 'Value': request.transport_task?.vehicle_details || 'Pending assignment' },
    { 'Attribute': 'Allocated Driver / Vendor', 'Value': request.transport_task?.driver_name || 'Pending assignment' },
    { 'Attribute': 'Report Exported By (Admin)', 'Value': `${adminUser.name || 'System Administrator'} (${adminUser.email || 'admin@bank.internal'})` },
    { 'Attribute': 'Export Timestamp', 'Value': exportDateStr }
  ]

  const wsMeta = XLSX.utils.json_to_sheet(metaRows)
  autoFitColumns(wsMeta, metaRows)
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Request Overview')

  // Trigger download in browser
  const filename = `FAM-Audit-${request.reference_no || request.id}-${now.toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * EXPORT 2: Periodic Audit Log Export across All Requests or Date Range
 * @param {Array} requests - Array of requests with audit logs
 * @param {Array} auditLogs - Array of raw or combined audit logs
 * @param {Object} filterParams - { startDate, endDate, pool, status }
 * @param {Object} adminUser - Active admin persona
 */
export function exportPeriodicAuditToExcel(requests = [], auditLogs = [], filterParams = {}, adminUser = {}) {
  const wb = XLSX.utils.book_new()
  const now = new Date()
  const exportDateStr = now.toISOString().replace('T', ' ').substring(0, 19)

  const { startDate, endDate, pool, status } = filterParams

  // Filter logs by date range and pool/status if specified
  const filteredLogs = (auditLogs || []).filter(log => {
    if (!log.created_at) return true
    const logTime = new Date(log.created_at).getTime()
    if (startDate) {
      const sTime = new Date(`${startDate}T00:00:00Z`).getTime()
      if (logTime < sTime) return false
    }
    if (endDate) {
      const eTime = new Date(`${endDate}T23:59:59Z`).getTime()
      if (logTime > eTime) return false
    }
    if (pool && pool !== 'all') {
      const pName = (log.performed_by_name || '').toLowerCase()
      const action = (log.action || '').toLowerCase()
      if (pool === 'ama' && !pName.includes('ama') && !pName.includes('archive') && !pName.includes('asset') && !action.includes('ama') && !action.includes('register')) {
        return false
      }
      if (pool === 'it' && !pName.includes('it ') && !pName.includes('infrastructure') && !action.includes('it_')) {
        return false
      }
      if (pool === 'transport' && !pName.includes('transport') && !pName.includes('fleet') && !action.includes('transport') && !action.includes('relocation')) {
        return false
      }
    }
    return true
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // ── SHEET 1: Master Chronological Audit Events ──────────────────────────────
  const masterRows = filteredLogs.map((log, idx) => {
    // Find associated request if available
    const req = requests.find(r => r.id === (log.movement_request_id || log.requestId))
    return {
      'Event ID': log.id || idx + 1,
      'Timestamp (UTC)': formatExcelDateTime(log.created_at),
      'Request Reference': req?.reference_no || (log.movement_request_id ? `REQ-${log.movement_request_id}` : 'General'),
      'Request Status': (req?.status || '—').replace(/_/g, ' ').toUpperCase(),
      'Lifecycle Event / Action': (log.action || '').replace(/_/g, ' '),
      'Officer Name & Designation': log.performed_by_name || 'System / Automated',
      'Assigned Department / Pool': (log.performed_by_name?.includes('AMA') || log.action?.includes('AMA') || log.action?.includes('REGISTER'))
        ? 'Asset Management \& Archives Department Pool'
        : ((log.performed_by_name?.includes('IT') || log.action?.includes('IT'))
          ? 'IT Infrastructure & Systems Pool'
          : ((log.performed_by_name?.includes('Transport') || log.action?.includes('TRANSPORT')) ? 'Transport & Logistics Pool' : 'Unit Review / System')),
      'Operational Remarks / Notes': log.remarks || '—',
      'Pick-up Location': req?.present_location || '—',
      'Destination Location': req?.new_location || '—',
      'Priority': req?.priority || 'Normal'
    }
  })

  const wsMaster = XLSX.utils.json_to_sheet(masterRows.length > 0 ? masterRows : [{ 'Notice': 'No audit logs matched the specified filter criteria.' }])
  autoFitColumns(wsMaster, masterRows)
  XLSX.utils.book_append_sheet(wb, wsMaster, 'Audit Log Master Events')

  // ── SHEET 2: Requests Turnaround Time & Bottleneck Summary ─────────────────
  const requestSummaryRows = (requests || []).map(r => {
    const rawLogs = r.audit_log || []
    let totalTat = 'In Progress'
    if (r.status === 'closed' && r.created_at && r.ama_closed_at) {
      const diff = new Date(r.ama_closed_at).getTime() - new Date(r.created_at).getTime()
      totalTat = formatDuration(Math.max(0, diff))
    }

    return {
      'Reference Number': r.reference_no || `REQ-${r.id}`,
      'Date Submitted': formatExcelDateTime(r.created_at),
      'Requesting Officer': r.requester_name || '—',
      'Department / Unit': r.requester_department || r.department || '—',
      'Current Status': (r.status || '').replace(/_/g, ' ').toUpperCase(),
      'Total Turnaround Time (TAT)': totalTat,
      'Unit Head Review Date': formatExcelDateTime(r.head_approved_at),
      'Asset Verification Date (AMA Pool)': formatExcelDateTime(r.ama_officer_approved_at),
      'Final Authorization Date (AMA Pool)': formatExcelDateTime(r.ama_head_approved_at),
      'Physical Relocation Handover Date': formatExcelDateTime(r.transport_task?.completed_at),
      'Register Closed Date (AMA Pool)': formatExcelDateTime(r.ama_closed_at),
      'Pick-up Location': r.present_location,
      'Destination': r.new_location
    }
  })

  const wsReqs = XLSX.utils.json_to_sheet(requestSummaryRows)
  autoFitColumns(wsReqs, requestSummaryRows)
  XLSX.utils.book_append_sheet(wb, wsReqs, 'Requests TAT Summary')

  // ── SHEET 3: Report Scope & Audit Metadata ─────────────────────────────────
  const paramRows = [
    { 'Parameter': 'Report Title', 'Detail': 'Institutional Audit Trail & SLA Performance Report' },
    { 'Parameter': 'Institution', 'Detail': 'Fixed Asset Movement Service (Enterprise Bank)' },
    { 'Parameter': 'Generated By (Admin)', 'Detail': `${adminUser.name || 'System Administrator'} (${adminUser.email || 'admin@bank.internal'})` },
    { 'Parameter': 'Generation Timestamp', 'Detail': exportDateStr },
    { 'Parameter': 'Filtered Start Date', 'Detail': startDate || 'All History (No start limit)' },
    { 'Parameter': 'Filtered End Date', 'Detail': endDate || 'All History (No end limit)' },
    { 'Parameter': 'Department Pool Filter', 'Detail': pool === 'ama' ? 'Asset Management \& Archives Pool Only' : (pool === 'transport' ? 'Transport & Logistics Pool Only' : 'All Department Pools') },
    { 'Parameter': 'Status Filter', 'Detail': status || 'All Request Statuses' },
    { 'Parameter': 'Total Matching Audit Events', 'Detail': filteredLogs.length },
    { 'Parameter': 'Total Movement Requests Audited', 'Detail': requests.length },
    { 'Parameter': 'Confidentiality Classification', 'Detail': 'RESTRICTED • Internal Institutional Audit Compliance Only' }
  ]

  const wsParams = XLSX.utils.json_to_sheet(paramRows)
  autoFitColumns(wsParams, paramRows)
  XLSX.utils.book_append_sheet(wb, wsParams, 'Audit Report Metadata')

  const sLabel = startDate ? startDate : 'all'
  const eLabel = endDate ? endDate : 'now'
  const filename = `FAM-Institutional-Audit-Log-${sLabel}-to-${eLabel}.xlsx`
  XLSX.writeFile(wb, filename)
}

