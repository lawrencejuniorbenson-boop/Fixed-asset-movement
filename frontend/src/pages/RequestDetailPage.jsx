import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle, Truck, Server, ChevronRight, Hourglass, Printer } from 'lucide-react'
import api from '../api/client'
import { useAuth, errorText } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import StatusBadge from '../components/StatusBadge'
import StageProgress from '../components/StageProgress'
import ActivityLog from '../components/ActivityLog'
import MovementFormView from '../components/MovementFormView'
import RequestAuditHistory from '../components/RequestAuditHistory'
import { PriorityTag } from '../components/RequestList'
import { taskPath } from '../components/TaskList'
import { CardSkeleton } from '../components/LoadingSkeleton'
import { formatDate, formatDateTime } from '../lib/format'
import { nextAction, canReject, STAGES, stageIndex, statusLabel } from '../lib/workflow'

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || '—'}</dd>
    </div>
  )
}

function ActionPanel({ request, user, onDone }) {
  const toast = useToast()
  const action = nextAction(request, user)
  const rejectable = canReject(request, user)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(null)

  if (!action && !rejectable) {
    if (['closed', 'rejected'].includes(request.status)) return null
    const stage = STAGES[stageIndex(request.status)]
    const own = String(request.requesting_officer_id) === String(user?.id)
    return (
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 print:hidden">
        <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p>
          Waiting for the <strong className="font-medium text-slate-800">{stage?.owner || 'next approver'}</strong>
          {stage ? ` (${stage.label.toLowerCase()})` : ''}.
          {own && ' You will see the update here once they act.'}
        </p>
      </div>
    )
  }

  const run = async (kind) => {
    if (kind === 'reject' && !remarks.trim()) {
      toast.error('Please give a reason for rejecting.')
      return
    }
    if (kind === 'reject' && !window.confirm('Reject this request? This cannot be undone.')) return
    setBusy(kind)
    try {
      const path = kind === 'reject' ? 'reject' : action.kind === 'close' ? 'close' : 'approve'
      await api.post(`/requests/${request.id}/${path}`, { remarks: remarks.trim() || undefined })
      toast.success(kind === 'reject' ? 'Request rejected.' : action.kind === 'close' ? 'Register updated and request closed.' : 'Done. The request has moved to the next stage.')
      setRemarks('')
      await onDone()
    } catch (err) {
      toast.error(errorText(err, 'The action could not be completed.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm ring-4 ring-blue-50 print:hidden" aria-labelledby="action-title">
      <h2 id="action-title" className="section-title">{action ? action.title : 'Review'}</h2>
      <p className="mt-1 text-sm text-slate-600">{action ? action.help : 'You can reject this request at its current stage.'}</p>
      <div className="mt-4">
        <label htmlFor="remarks" className="label">
          Remarks <span className="font-normal text-slate-400">{rejectable ? '(required to reject)' : '(optional)'}</span>
        </label>
        <textarea
          id="remarks"
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="input-field"
          placeholder={action?.kind === 'close' ? 'e.g. Register updated with new location codes.' : 'Add a note for the record'}
        />
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {rejectable && (
          <button type="button" onClick={() => run('reject')} disabled={!!busy} className="btn-danger">
            <XCircle className="h-4 w-4" aria-hidden="true" /> {busy === 'reject' ? 'Rejecting…' : 'Reject'}
          </button>
        )}
        {action && (
          <button type="button" onClick={() => run('approve')} disabled={!!busy} className="btn-primary">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {busy === 'approve' ? 'Saving…' : action.label}
          </button>
        )}
      </div>
    </section>
  )
}

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'form', label: 'Official form' },
  { key: 'timing', label: 'Stage timing' }
]

export default function RequestDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('details')

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/requests/${id}`)
      setRequest(res.data?.data || null)
      setError('')
    } catch (err) {
      setError(errorText(err, 'Could not load this request.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { setLoading(true); load() }, [load, user?.id])

  if (loading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>

  if (error || !request) {
    return (
      <div className="card text-center">
        <p className="text-sm text-slate-600">{error || 'This request does not exist, or you do not have access to it.'}</p>
        <Link to="/requests" className="btn-secondary mt-4">Back to requests</Link>
      </div>
    )
  }

  const task = request.transport_task
  const isItMove = request.fulfillment_type === 'it'

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link to="/requests" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Requests
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold text-slate-900 sm:text-2xl">{request.reference_no}</h1>
              <StatusBadge status={request.status} fulfillmentType={request.fulfillment_type} />
              <PriorityTag priority={request.priority} />
            </div>
            <p className="page-subtitle">
              Requested by {request.requester_name}
              {request.requester_department ? ` · ${request.requester_department}` : ''} · {formatDateTime(request.created_at)}
            </p>
          </div>
          {request.status === 'closed' && (
            <button type="button" className="btn-secondary self-start" onClick={() => { setTab('form'); setTimeout(() => window.print(), 150) }}>
              <Printer className="h-4 w-4" aria-hidden="true" /> Print form
            </button>
          )}
        </div>
      </div>

      <div className="card print:hidden">
        <StageProgress request={request} />
        {request.status === 'rejected' && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <strong className="font-medium">Rejected{request.rejected_by_name ? ` by ${request.rejected_by_name}` : ''}{request.rejected_at ? ` on ${formatDate(request.rejected_at)}` : ''}.</strong>{' '}
            {request.rejection_remarks}
          </p>
        )}
      </div>

      <ActionPanel request={request} user={user} onDone={load} />

      <div className="border-b border-slate-200 print:hidden" role="tablist" aria-label="Request views">
        <div className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 border-b-2 pb-2.5 text-sm font-medium transition-colors ${
                tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'details' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="min-w-0 space-y-6 lg:col-span-3">
            <section className="card">
              <h2 className="section-title">Movement</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="From">{request.present_location}</Field>
                <Field label="To">{request.new_location}</Field>
                <div className="sm:col-span-2"><Field label="Purpose">{request.purpose}</Field></div>
                <Field label="Requested move date">{formatDate(request.movement_date)}</Field>
                <Field label="Handled by">{isItMove ? 'IT pool' : 'Transport pool'}</Field>
                <Field label="Officer doing the movement">{request.officer_doing_movement}</Field>
                <Field label="Authorizing head (named on form)">{request.authorized_by}</Field>
              </dl>
            </section>

            <section className="card-flat overflow-hidden">
              <h2 className="section-title px-5 pt-5">Assets ({request.items.length})</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th scope="col" className="w-12 px-5 py-2 font-medium">#</th>
                      <th scope="col" className="px-3 py-2 font-medium">Asset</th>
                      <th scope="col" className="px-5 py-2 font-medium">Asset code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {request.items.map((it, i) => (
                      <tr key={it.id || i}>
                        <td className="px-5 py-2.5 text-slate-400">{it.item_no || i + 1}</td>
                        <td className="px-3 py-2.5 text-slate-900">{it.name_of_asset}</td>
                        <td className="px-5 py-2.5 font-mono text-[13px] text-slate-700">{it.asset_code || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {task && (
              <Link to={taskPath(task)} className="card flex items-center gap-4 transition-colors hover:border-slate-300">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  {isItMove ? <Server className="h-5 w-5" aria-hidden="true" /> : <Truck className="h-5 w-5" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{isItMove ? 'IT' : 'Transport'}: {statusLabel(task.status)}</p>
                  <p className="truncate text-sm text-slate-500">
                    {[task.assigned_officer_name, task.vehicle_details, task.scheduled_date && formatDate(task.scheduled_date)].filter(Boolean).join(' · ') || 'Not scheduled yet'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </Link>
            )}
          </div>

          <section className="card min-w-0 lg:col-span-2">
            <h2 className="section-title mb-4">Activity</h2>
            <ActivityLog entries={request.audit_log} />
          </section>
        </div>
      )}

      {tab === 'form' && <MovementFormView request={request} />}
      {tab === 'timing' && <RequestAuditHistory request={request} auditLog={request.audit_log} />}
    </div>
  )
}
