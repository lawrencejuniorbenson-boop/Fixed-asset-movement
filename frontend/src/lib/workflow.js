// Single source of truth for roles, stages and "who can do what" in the UI.
// These rules mirror the database triggers in supabase_schema.sql. The
// database is what actually enforces them; the UI only uses them to show the
// right buttons.

export const ROLES = [
  { value: 'requesting_officer', label: 'Requesting Officer', short: 'Requester' },
  { value: 'department_head', label: 'Department Head', short: 'Dept. Head' },
  { value: 'ama_officer', label: 'AMA Officer', short: 'AMA Officer' },
  { value: 'ama_head', label: 'AMA Head', short: 'AMA Head' },
  { value: 'transport_head', label: 'Transport Head', short: 'Transport Head' },
  { value: 'transport_officer', label: 'Transport Officer', short: 'Transport Officer' },
  { value: 'it_head', label: 'IT Head', short: 'IT Head' },
  { value: 'it_officer', label: 'IT Officer', short: 'IT Officer' },
  { value: 'auditor', label: 'Internal Auditor', short: 'Auditor' },
  { value: 'admin', label: 'Administrator', short: 'Admin' }
]

export const roleLabel = (role) => ROLES.find((r) => r.value === role)?.label || role || ''

export const isAdmin = (u) => u?.role === 'admin'
export const isAuditor = (u) => u?.role === 'auditor'
export const isRequester = (u) => u?.role === 'requesting_officer'
export const isDeptHead = (u) => u?.role === 'department_head'
export const isAma = (u) => u?.role === 'ama_officer' || u?.role === 'ama_head'
export const isTransport = (u) => u?.role === 'transport_head' || u?.role === 'transport_officer'
export const isIt = (u) => u?.role === 'it_head' || u?.role === 'it_officer'

export const canCreateRequest = (u) => !!u && !isAuditor(u)
export const canSeeAudit = (u) => isAdmin(u) || isAuditor(u)
export const canManageUsers = (u) => isAdmin(u)

// The movement lifecycle, in order.
export const STAGES = [
  { status: 'pending_head', label: 'Department approval', owner: 'Department Head' },
  { status: 'head_approved', label: 'AMA approval', owner: 'AMA pool' },
  { status: 'fully_approved', label: 'Awaiting pickup', owner: 'Transport / IT pool' },
  { status: 'in_transport', label: 'In transit', owner: 'Transport / IT pool' },
  { status: 'transport_completed', label: 'Register update', owner: 'AMA pool' },
  { status: 'closed', label: 'Closed', owner: '' }
]

export const OPEN_STATUSES = ['pending_head', 'head_approved', 'ama_officer_approved', 'fully_approved', 'in_transport', 'transport_completed']
export const APPROVAL_STATUSES = ['pending_head', 'head_approved', 'ama_officer_approved']
export const MOVING_STATUSES = ['fully_approved', 'in_transport']

export function stageIndex(status) {
  // 'ama_officer_approved' only exists on requests from the older two-step
  // AMA flow; it belongs to the AMA approval stage.
  const s = status === 'ama_officer_approved' ? 'head_approved' : status
  return STAGES.findIndex((x) => x.status === s)
}

const poolFor = (request) => (request?.fulfillment_type === 'it' ? 'IT' : 'Transport')

// Short, plain-language status for badges.
export function statusLabel(status, fulfillmentType) {
  const pool = fulfillmentType === 'it' ? 'IT' : 'Transport'
  switch (status) {
    case 'pending_head': return 'Awaiting department head'
    case 'head_approved': return 'Awaiting AMA approval'
    case 'ama_officer_approved': return 'Awaiting AMA authorization'
    case 'fully_approved': return `Awaiting ${pool} pickup`
    case 'in_transport': return 'In transit'
    case 'transport_completed': return 'Awaiting register update'
    case 'closed': return 'Closed'
    case 'rejected': return 'Rejected'
    // transport task statuses
    case 'pending_assignment': return 'Needs assignment'
    case 'officer_assigned': return 'Scheduled'
    case 'in_progress': return 'In transit'
    case 'completed': return 'Delivered'
    default: return (status || 'Unknown').replace(/_/g, ' ')
  }
}

export function statusTone(status) {
  if (status === 'rejected') return 'red'
  if (status === 'closed' || status === 'completed') return 'gray'
  if (status === 'transport_completed') return 'green'
  if (['fully_approved', 'in_transport', 'officer_assigned', 'in_progress'].includes(status)) return 'blue'
  return 'amber'
}

const isOwn = (request, u) => String(request?.requesting_officer_id) === String(u?.id)

// The approve/close action the user can take on this request, or null.
export function nextAction(request, u) {
  if (!request || !u) return null
  const admin = isAdmin(u)
  // Nobody approves or closes their own request (enforced in the database).
  if (!admin && isOwn(request, u)) return null

  switch (request.status) {
    case 'pending_head':
      return admin || isDeptHead(u)
        ? { kind: 'approve', label: 'Approve', title: 'Department approval', help: 'Confirm this movement is needed for your department.' }
        : null
    case 'head_approved':
      return admin || isAma(u)
        ? {
            kind: 'approve',
            label: 'Verify & authorize',
            title: 'AMA verification and approval',
            help: `Check the asset names and codes against the fixed asset register. Approving authorizes the movement and sends it to the ${poolFor(request)} pool for pickup.`
          }
        : null
    case 'ama_officer_approved': // older two-step requests only
      return admin || isAma(u)
        ? { kind: 'approve', label: 'Authorize movement', title: 'Final authorization', help: `Authorizing sends this request to the ${poolFor(request)} pool for pickup.` }
        : null
    case 'transport_completed':
      return admin || isAma(u)
        ? { kind: 'close', label: 'Update register & close', title: 'Register update', help: 'The assets have arrived. Update the fixed asset register, then close the file.' }
        : null
    default:
      return null
  }
}

export function canReject(request, u) {
  if (!request || !u) return false
  if (isAdmin(u)) return APPROVAL_STATUSES.includes(request.status)
  if (request.status === 'pending_head') return isDeptHead(u)
  if (['head_approved', 'ama_officer_approved'].includes(request.status)) return isAma(u)
  return false
}

// Transport / IT task actions
export function canWorkTask(task, u) {
  if (!task || !u) return false
  if (isAdmin(u)) return true
  return task.fulfillment_type === 'it' ? isIt(u) : isTransport(u)
}

export function needsMyAction(request, u) {
  return !!nextAction(request, u)
}
