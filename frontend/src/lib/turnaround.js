// Turnaround times for a request, computed ONLY from recorded timestamps.
// A step without a recorded time is reported as unknown, never estimated.

const PICKUP_ACTIONS = ['TRANSPORT_STARTED_BY_POOL', 'IT_EQUIPMENT_PICKUP_STARTED']

const t = (v) => (v ? new Date(v).getTime() : null)

export const TAT_STAGES = [
  { key: 'dept', label: 'Department approval', short: 'Dept.' },
  { key: 'ama', label: 'AMA approval', short: 'AMA' },
  { key: 'pickup', label: 'Waiting for pickup', short: 'Pickup' },
  { key: 'transit', label: 'In transit', short: 'Transit' },
  { key: 'register', label: 'Register update', short: 'Register' }
]

export function outcomeOf(r) {
  if (r.status === 'closed') return 'completed'
  if (r.status === 'rejected') return 'rejected'
  return 'in_progress'
}

/**
 * Returns { stages: [{key,label,start,end,ms,state}], totalMs, outcome, endedAt }
 * state: 'done' | 'current' | 'rejected' | 'skipped' | 'unknown' | 'not_reached'
 */
export function computeTurnaround(r, now = Date.now()) {
  const task = r.transport_task || null
  const log = r.audit_log || []
  const pickupLog = log.find((e) => PICKUP_ACTIONS.includes(e.action))

  const submitted = t(r.created_at)
  const headAt = t(r.head_approved_at)
  const amaAt = t(r.ama_head_approved_at)
  const pickupAt = t(pickupLog?.created_at)
  const deliveredAt = t(task?.completed_at)
  const closedAt = t(r.ama_closed_at)
  const rejectedAt = t(r.rejected_at)
  const outcome = outcomeOf(r)

  const bounds = [
    ['dept', submitted, headAt],
    ['ama', headAt, amaAt],
    ['pickup', amaAt, pickupAt],
    ['transit', pickupAt, deliveredAt],
    ['register', deliveredAt, closedAt]
  ]

  // Which stage is the request in (or stopped at)?
  const statusStage = {
    pending_head: 'dept', head_approved: 'ama', ama_officer_approved: 'ama',
    fully_approved: 'pickup', in_transport: 'transit', transport_completed: 'register'
  }[r.status]
  const rejectedStage = outcome === 'rejected' ? (headAt ? 'ama' : 'dept') : null
  const activeKey = rejectedStage || statusStage || null
  const activeIdx = TAT_STAGES.findIndex((s) => s.key === activeKey)

  const stages = TAT_STAGES.map((s, i) => {
    const [, start, end] = bounds[i]
    let state
    let from = start
    let to = end
    if (outcome === 'completed' || (activeIdx >= 0 && i < activeIdx)) {
      state = from != null && to != null ? 'done' : 'unknown'
    } else if (i === activeIdx) {
      if (outcome === 'rejected') {
        state = 'rejected'
        to = rejectedAt
      } else {
        state = 'current'
        to = now
      }
    } else {
      state = outcome === 'rejected' ? 'skipped' : 'not_reached'
      from = null
      to = null
    }
    const ms = from != null && to != null ? Math.max(0, to - from) : null
    return { ...s, start: from, end: to, ms, state }
  })

  const endedAt = outcome === 'completed' ? closedAt : outcome === 'rejected' ? rejectedAt : null
  const totalMs = submitted != null ? Math.max(0, (endedAt ?? now) - submitted) : null
  return { stages, totalMs, outcome, endedAt }
}

export function formatSpan(ms) {
  if (ms == null) return '—'
  const m = Math.round(ms / 60000)
  if (m < 1) return '< 1 min'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h < 24) return mm ? `${h}h ${mm}m` : `${h}h`
  const d = Math.floor(h / 24)
  const hh = h % 24
  return hh ? `${d}d ${hh}h` : `${d}d`
}

export const SLOW_MS = 48 * 3600 * 1000

export function average(values) {
  const v = values.filter((x) => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
