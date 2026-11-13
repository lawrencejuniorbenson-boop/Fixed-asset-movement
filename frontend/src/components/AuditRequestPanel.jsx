import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X, ExternalLink, FileSpreadsheet, Truck, Server } from 'lucide-react'
import StatusBadge from './StatusBadge'
import ActivityLog from './ActivityLog'
import { PriorityTag } from './RequestList'
import { formatDate, formatDateTime } from '../lib/format'
import { computeTurnaround, formatSpan, SLOW_MS } from '../lib/turnaround'
import { statusLabel } from '../lib/workflow'
import { calculateStageDurations } from '../utils/slaAnalytics'
import { exportSingleRequestAuditToExcel } from '../utils/excelExporter'

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || '—'}</dd>
    </div>
  )
}

const STATE_TEXT = {
  done: 'Done',
  current: 'In progress',
  rejected: 'Rejected here',
  skipped: 'Not reached',
  not_reached: 'Not reached',
  unknown: 'Not recorded'
}

/**
 * Everything about one request for auditors: facts, turnaround per stage,
 * assets, the move, and the full recorded activity.
 */
export default function AuditRequestPanel({ request: r, user, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  if (!r) return null
  const tat = computeTurnaround(r)
  const task = r.transport_task
  const isIt = r.fulfillment_type === 'it'
  const maxMs = Math.max(1, ...tat.stages.map((s) => s.ms || 0))

  const exportExcel = () => {
    exportSingleRequestAuditToExcel(r, calculateStageDurations(r, r.audit_log || []), r.audit_log || [], user || {})
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="panel-title">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="panel-title" className="font-mono text-lg font-semibold text-slate-900">{r.reference_no}</h2>
              <StatusBadge status={r.status} fulfillmentType={r.fulfillment_type} />
              <PriorityTag priority={r.priority} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {r.requester_name}{r.requester_department ? ` · ${r.requester_department}` : ''} · submitted {formatDateTime(r.created_at)}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Turnaround */}
          <section aria-labelledby="tat-title">
            <div className="flex items-end justify-between gap-3">
              <h3 id="tat-title" className="section-title">Turnaround</h3>
              <p className="text-sm text-slate-600">
                {tat.outcome === 'completed' ? 'Total' : tat.outcome === 'rejected' ? 'Until rejection' : 'So far'}:{' '}
                <strong className="font-semibold text-slate-900">{formatSpan(tat.totalMs)}</strong>
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {tat.stages.map((s) => (
                <li key={s.key} className="grid grid-cols-[9.5rem_1fr_5.5rem] items-center gap-3 text-sm">
                  <span className={s.state === 'not_reached' || s.state === 'skipped' ? 'text-slate-400' : 'text-slate-700'}>{s.label}</span>
                  <span className="h-2 rounded-full bg-slate-100" aria-hidden="true">
                    {s.ms != null && (
                      <span
                        className={`block h-2 rounded-full ${s.state === 'rejected' ? 'bg-red-400' : s.ms > SLOW_MS ? 'bg-amber-400' : s.state === 'current' ? 'bg-blue-300' : 'bg-blue-500'}`}
                        style={{ width: `${Math.max(4, (s.ms / maxMs) * 100)}%` }}
                      />
                    )}
                  </span>
                  <span className="text-right">
                    <span className="block font-medium tabular-nums text-slate-900">{s.ms != null ? formatSpan(s.ms) : '—'}</span>
                    <span className={`block text-[11px] ${s.state === 'rejected' ? 'text-red-600' : s.state === 'current' ? 'text-blue-600' : 'text-slate-400'}`}>{STATE_TEXT[s.state]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">Amber bars took more than 2 days. Times are taken only from recorded events.</p>
          </section>

          {/* Facts */}
          <section aria-labelledby="facts-title">
            <h3 id="facts-title" className="section-title">Request</h3>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Fact label="From">{r.present_location}</Fact>
              <Fact label="To">{r.new_location}</Fact>
              <div className="sm:col-span-2"><Fact label="Purpose">{r.purpose}</Fact></div>
              <Fact label="Requested move date">{formatDate(r.movement_date)}</Fact>
              <Fact label="Handled by">{isIt ? 'IT pool' : 'Transport pool'}</Fact>
              <Fact label="Department approval">{r.head_approver_name ? `${r.head_approver_name}, ${formatDateTime(r.head_approved_at)}` : null}</Fact>
              <Fact label="AMA approval">{r.ama_head_name ? `${r.ama_head_name}, ${formatDateTime(r.ama_head_approved_at)}` : null}</Fact>
              <Fact label="Register closed">{r.ama_closed_name ? `${r.ama_closed_name}, ${formatDateTime(r.ama_closed_at)}` : null}</Fact>
              {r.status === 'rejected' && (
                <Fact label="Rejected">{[r.rejected_by_name, r.rejected_at && formatDateTime(r.rejected_at), r.rejection_remarks].filter(Boolean).join(' · ')}</Fact>
              )}
            </dl>
          </section>

          {/* Move */}
          {task && (
            <section className="rounded-xl border border-slate-200 p-4" aria-labelledby="move-title">
              <h3 id="move-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                {isIt ? <Server className="h-4 w-4 text-slate-500" aria-hidden="true" /> : <Truck className="h-4 w-4 text-slate-500" aria-hidden="true" />}
                {isIt ? 'IT' : 'Transport'}: {statusLabel(task.status)}
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <Fact label="Officer">{task.assigned_officer_name}</Fact>
                <Fact label="Scheduled">{task.scheduled_date ? formatDate(task.scheduled_date) : null}</Fact>
                <Fact label={isIt ? 'Carrier' : 'Vehicle'}>{task.vehicle_details}</Fact>
                <Fact label="Driver / contractor">{task.driver_name || task.vendor_name}</Fact>
                <Fact label="Delivered">{task.completed_at ? formatDateTime(task.completed_at) : null}</Fact>
                <Fact label="Delivery notes">{task.completion_notes}</Fact>
              </dl>
            </section>
          )}

          {/* Assets */}
          <section aria-labelledby="assets-title">
            <h3 id="assets-title" className="section-title">Assets ({(r.items || []).length})</h3>
            <table className="mt-3 w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2 font-medium">#</th>
                  <th scope="col" className="px-3 py-2 font-medium">Asset</th>
                  <th scope="col" className="px-3 py-2 font-medium">Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(r.items || []).map((it, i) => (
                  <tr key={it.id || i}>
                    <td className="px-3 py-2 text-slate-400">{it.item_no || i + 1}</td>
                    <td className="px-3 py-2 text-slate-900">{it.name_of_asset}</td>
                    <td className="px-3 py-2 font-mono text-[13px] text-slate-700">{it.asset_code || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Activity */}
          <section aria-labelledby="activity-title">
            <h3 id="activity-title" className="section-title mb-3">Activity ({(r.audit_log || []).length})</h3>
            <ActivityLog entries={r.audit_log} />
          </section>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={exportExcel} className="btn-secondary">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Export to Excel
          </button>
          <Link to={`/requests/${r.id}`} className="btn-primary">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open full request
          </Link>
        </div>
      </div>
    </div>
  )
}
