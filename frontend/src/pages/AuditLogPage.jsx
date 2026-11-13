import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, FileSpreadsheet, ShieldCheck, ShieldAlert } from 'lucide-react'
import api from '../api/client'
import { useAuth, errorText } from '../context/AuthContext'
import AdminAuditExportModal from '../components/AdminAuditExportModal'
import LoadingSkeleton from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import { actionLabel } from '../components/ActivityLog'
import { formatDateTime } from '../lib/format'
import { formatDuration } from '../utils/slaAnalytics'
import { canSeeAudit } from '../lib/workflow'

// Which group performed an action, decided by the action itself (not by names).
const ACTION_GROUP = {
  REQUEST_SUBMITTED: 'Requester',
  HEAD_APPROVED: 'Department head',
  ASSET_VERIFIED_BY_AMA_POOL: 'AMA pool',
  FINAL_AUTHORIZATION_BY_AMA_POOL: 'AMA pool',
  AMA_POOL_VERIFIED_AND_AUTHORIZED: 'AMA pool',
  REGISTER_UPDATED_AND_CLOSED_BY_AMA_POOL: 'AMA pool',
  OFFICER_ASSIGNED: 'Transport pool',
  TRANSPORT_STARTED_BY_POOL: 'Transport pool',
  RELOCATION_COMPLETED_BY_TRANSPORT_POOL: 'Transport pool',
  IT_OFFICER_ASSIGNED: 'IT pool',
  IT_EQUIPMENT_PICKUP_STARTED: 'IT pool',
  IT_RELOCATION_COMPLETED: 'IT pool'
}
const groupOf = (e) => (e.action === 'REQUEST_REJECTED' ? 'Rejections' : ACTION_GROUP[e.action] || 'Other')
const GROUPS = ['All', 'Requester', 'Department head', 'AMA pool', 'Transport pool', 'IT pool', 'Rejections']

const PERIODS = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
  { key: 'all', label: 'All time', days: null }
]

const SLOW_MS = 48 * 3600 * 1000

export default function AuditLogPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('All')
  const [period, setPeriod] = useState('90')
  const [exportOpen, setExportOpen] = useState(false)

  const allowed = canSeeAudit(user)

  useEffect(() => {
    if (!allowed) return
    api.get('/requests')
      .then((res) => setRequests(res.data?.data || []))
      .catch((err) => setError(errorText(err, 'Could not load the audit trail.')))
      .finally(() => setLoading(false))
  }, [allowed, user?.id])

  // Every recorded entry, with the time taken since the previous step of the same request.
  const events = useMemo(() => {
    const out = []
    requests.forEach((r) => {
      const logs = r.audit_log || []
      logs.forEach((e, i) => {
        const prev = logs[i - 1]
        const waitMs = prev ? Math.max(0, new Date(e.created_at) - new Date(prev.created_at)) : null
        out.push({ ...e, request: r, waitMs })
      })
    })
    return out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [requests])

  if (!allowed) {
    return (
      <div className="card text-center">
        <ShieldAlert className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
        <p className="mt-2 text-sm text-slate-600">The audit trail is available to administrators and internal auditors.</p>
      </div>
    )
  }

  const days = PERIODS.find((p) => p.key === period)?.days
  const since = days ? Date.now() - days * 86400000 : null
  const q = search.trim().toLowerCase()
  const filtered = events.filter((e) => {
    if (since && new Date(e.created_at).getTime() < since) return false
    if (group !== 'All' && groupOf(e) !== group) return false
    if (!q) return true
    return [e.request.reference_no, e.performed_by_name, e.remarks, actionLabel(e.action), e.request.present_location, e.request.new_location]
      .join(' ').toLowerCase().includes(q)
  })
  const slow = filtered.filter((e) => e.waitMs > SLOW_MS).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Audit trail</h1>
          <p className="page-subtitle">Every recorded action on every movement request. Entries cannot be edited or deleted.</p>
        </div>
        <button type="button" onClick={() => setExportOpen(true)} className="btn-secondary self-start">
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Export to Excel
        </button>
      </div>

      <div className="card-flat overflow-hidden">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, person, remarks…" className="input-field pl-9" aria-label="Search audit trail" />
          </div>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="input-field" aria-label="Who acted">
            {GROUPS.map((g) => <option key={g} value={g}>{g === 'All' ? 'Everyone' : g}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input-field" aria-label="Period">
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>

        {!loading && !error && (
          <p className="border-b border-slate-100 px-5 py-2.5 text-sm text-slate-500">
            {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}
            {slow > 0 && <> · <span className="text-amber-700">{slow} took more than 2 days after the previous step</span></>}
          </p>
        )}

        {error ? (
          <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
        ) : loading ? (
          <LoadingSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No entries" description="Nothing matches these filters." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.slice(0, 300).map((e) => (
              <li key={e.id} className="px-5 py-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">{e.performed_by_name}</span>{' '}
                      <span className="text-slate-600">{actionLabel(e.action).replace(/^\w/, (c) => c.toLowerCase())}</span>{' '}
                      <Link to={`/requests/${e.request.id}`} className="font-mono text-[13px] text-blue-700 hover:underline">{e.request.reference_no}</Link>
                    </p>
                    {e.remarks && <p className="mt-1 text-sm text-slate-500">“{e.remarks}”</p>}
                  </div>
                  <div className="shrink-0 text-left text-xs text-slate-400 sm:text-right">
                    <p>{formatDateTime(e.created_at)}</p>
                    <p className="mt-0.5">
                      <span className="badge badge-gray mr-1.5">{groupOf(e)}</span>
                      {e.waitMs != null && (
                        <span className={e.waitMs > SLOW_MS ? 'text-amber-700' : ''}>{formatDuration(e.waitMs)} after previous step</span>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {filtered.length > 300 && <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">Showing the newest 300 entries. Narrow the filters or export to Excel for the rest.</p>}
      </div>

      {exportOpen && <AdminAuditExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} requests={requests} user={user} />}
    </div>
  )
}
