import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, FileSpreadsheet, ShieldCheck, ShieldAlert, Timer, ListChecks, ChevronRight } from 'lucide-react'
import api from '../api/client'
import { useAuth, errorText } from '../context/AuthContext'
import AdminAuditExportModal from '../components/AdminAuditExportModal'
import AuditRequestPanel from '../components/AuditRequestPanel'
import LoadingSkeleton from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import { actionLabel } from '../components/ActivityLog'
import { formatDate, formatDateTime } from '../lib/format'
import { computeTurnaround, formatSpan, average, SLOW_MS, TAT_STAGES } from '../lib/turnaround'
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

const OUTCOMES = [
  { key: 'all', label: 'All requests' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' }
]

const OUTCOME_BADGE = {
  in_progress: { cls: 'badge-blue', text: 'In progress' },
  completed: { cls: 'badge-green', text: 'Completed' },
  rejected: { cls: 'badge-red', text: 'Rejected' }
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input-field pl-9" aria-label={placeholder} />
    </div>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div className="card-flat p-4">
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function StageCell({ s }) {
  if (s.state === 'not_reached' || s.state === 'skipped') return <span className="text-slate-300">—</span>
  if (s.ms == null) return <span className="text-slate-400" title="Not recorded">n/r</span>
  const cls = s.state === 'rejected' ? 'text-red-700' : s.state === 'current' ? 'text-blue-700' : s.ms > SLOW_MS ? 'text-amber-700' : 'text-slate-700'
  return (
    <span className={`tabular-nums ${cls}`} title={s.state === 'current' ? 'Still in this stage' : s.state === 'rejected' ? 'Rejected at this stage' : undefined}>
      {formatSpan(s.ms)}{s.state === 'current' && <span aria-hidden="true"> ●</span>}
    </span>
  )
}

// ── Turnaround view: one row per request ─────────────────────────────────────
function TurnaroundView({ requests, onOpen }) {
  const [search, setSearch] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [period, setPeriod] = useState('all')
  const [sort, setSort] = useState('newest')

  const rows = useMemo(() => requests.map((r) => ({ r, tat: computeTurnaround(r) })), [requests])

  const days = PERIODS.find((p) => p.key === period)?.days
  const since = days ? Date.now() - days * 86400000 : null
  const q = search.trim().toLowerCase()
  const filtered = rows
    .filter(({ r, tat }) => {
      if (outcome !== 'all' && tat.outcome !== outcome) return false
      if (since && new Date(r.created_at).getTime() < since) return false
      if (!q) return true
      return [r.reference_no, r.requester_name, r.requester_department, r.present_location, r.new_location, r.purpose,
        ...(r.items || []).flatMap((i) => [i.name_of_asset, i.asset_code])].join(' ').toLowerCase().includes(q)
    })
    .sort((a, b) => (sort === 'longest' ? (b.tat.totalMs || 0) - (a.tat.totalMs || 0) : new Date(b.r.created_at) - new Date(a.r.created_at)))

  const completed = filtered.filter((x) => x.tat.outcome === 'completed')
  const stageAvg = (key) => average(filtered.map((x) => x.tat.stages.find((s) => s.key === key)).filter((s) => s.state === 'done').map((s) => s.ms))
  const slowest = TAT_STAGES.map((s) => ({ ...s, avg: stageAvg(s.key) })).filter((s) => s.avg != null).sort((a, b) => b.avg - a.avg)[0]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Requests" value={filtered.length}
          sub={`${filtered.filter((x) => x.tat.outcome === 'in_progress').length} in progress · ${filtered.filter((x) => x.tat.outcome === 'rejected').length} rejected`} />
        <Tile label="Average turnaround" value={formatSpan(average(completed.map((x) => x.tat.totalMs)))} sub={`Submitted → closed, ${completed.length} completed`} />
        <Tile label="Average department approval" value={formatSpan(stageAvg('dept'))} sub="Submitted → department head" />
        <Tile label="Slowest stage on average" value={slowest ? slowest.label : '—'} sub={slowest ? formatSpan(slowest.avg) : 'Not enough data yet'} />
      </div>

      <div className="card-flat overflow-hidden">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_auto_auto_auto]">
          <SearchBox value={search} onChange={setSearch} placeholder="Find a request: reference, requester, location, asset…" />
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="input-field" aria-label="Outcome">
            {OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input-field" aria-label="Submitted in">
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.key === 'all' ? 'Submitted any time' : `Submitted ${p.label.toLowerCase()}`}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field" aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="longest">Longest turnaround first</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Timer} title="No requests found" description="Try a different search or filter." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-medium">Request</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Outcome</th>
                    {TAT_STAGES.map((s) => <th key={s.key} scope="col" className="px-3 py-2.5 text-right font-medium" title={s.label}>{s.short}</th>)}
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                    <th scope="col" className="w-8 px-3 py-2.5"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(({ r, tat }) => (
                    <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(r.id) }} className="font-mono text-[13px] font-medium text-slate-900 hover:text-blue-700">
                          {r.reference_no}
                        </button>
                        <p className="max-w-[14rem] truncate text-xs text-slate-500">{r.requester_name} · {formatDate(r.created_at)}</p>
                      </td>
                      <td className="px-3 py-3"><span className={`badge ${OUTCOME_BADGE[tat.outcome].cls}`}>{OUTCOME_BADGE[tat.outcome].text}</span></td>
                      {tat.stages.map((s) => <td key={s.key} className="whitespace-nowrap px-3 py-3 text-right"><StageCell s={s} /></td>)}
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{formatSpan(tat.totalMs)}</td>
                      <td className="px-3 py-3 text-slate-300"><ChevronRight className="h-4 w-4" aria-hidden="true" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400">
                <span className="text-blue-700">●</span> still in this stage · <span className="text-amber-700">amber</span> took more than 2 days · n/r not recorded · click a request for full details
              </p>
            </div>

            {/* Phones / tablets */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {filtered.map(({ r, tat }) => {
                const cur = tat.stages.find((s) => s.state === 'current' || s.state === 'rejected')
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => onOpen(r.id)} className="block w-full px-4 py-4 text-left hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-mono text-[13px] font-medium text-slate-900">{r.reference_no}</span>
                        <span className={`badge ${OUTCOME_BADGE[tat.outcome].cls}`}>{OUTCOME_BADGE[tat.outcome].text}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{r.requester_name} · {formatDate(r.created_at)}</p>
                      <p className="mt-1 text-sm text-slate-900">
                        {tat.outcome === 'completed' ? 'Turnaround' : tat.outcome === 'rejected' ? 'Until rejection' : 'Open for'}{' '}
                        <strong className="font-semibold">{formatSpan(tat.totalMs)}</strong>
                        {cur && tat.outcome === 'in_progress' && <span className="text-slate-500"> · now at {cur.label.toLowerCase()} ({formatSpan(cur.ms)})</span>}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

// ── Activity view: every recorded action ─────────────────────────────────────
function ActivityView({ requests, onOpen }) {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('All')
  const [period, setPeriod] = useState('90')

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
    <div className="card-flat overflow-hidden">
      <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 sm:grid-cols-[1fr_auto_auto]">
        <SearchBox value={search} onChange={setSearch} placeholder="Search reference, person, remarks…" />
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="input-field" aria-label="Who acted">
          {GROUPS.map((g) => <option key={g} value={g}>{g === 'All' ? 'Everyone' : g}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input-field" aria-label="Period">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      <p className="border-b border-slate-100 px-5 py-2.5 text-sm text-slate-500">
        {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}
        {slow > 0 && <> · <span className="text-amber-700">{slow} came more than 2 days after the previous step</span></>}
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No entries" description="Nothing matches these filters." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.slice(0, 300).map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onOpen(e.request.id)} className="block w-full px-5 py-4 text-left hover:bg-slate-50">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">{e.performed_by_name}</span>{' '}
                      <span className="text-slate-600">{actionLabel(e.action).replace(/^\w/, (c) => c.toLowerCase())}</span>{' '}
                      <span className="font-mono text-[13px] text-blue-700">{e.request.reference_no}</span>
                    </p>
                    {e.remarks && <p className="mt-1 text-sm text-slate-500">“{e.remarks}”</p>}
                  </div>
                  <div className="shrink-0 text-left text-xs text-slate-400 sm:text-right">
                    <p>{formatDateTime(e.created_at)}</p>
                    <p className="mt-0.5">
                      <span className="badge badge-gray mr-1.5">{groupOf(e)}</span>
                      {e.waitMs != null && <span className={e.waitMs > SLOW_MS ? 'text-amber-700' : ''}>{formatSpan(e.waitMs)} after previous step</span>}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {filtered.length > 300 && <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">Showing the newest 300 entries. Narrow the filters or export to Excel for the rest.</p>}
    </div>
  )
}

const VIEWS = [
  { key: 'turnaround', label: 'Turnaround per request', icon: Timer },
  { key: 'activity', label: 'All activity', icon: ListChecks }
]

export default function AuditLogPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportOpen, setExportOpen] = useState(false)

  const allowed = canSeeAudit(user)
  const view = params.get('view') === 'activity' ? 'activity' : 'turnaround'
  const openId = params.get('r')
  const openRequest = requests.find((r) => String(r.id) === String(openId)) || null

  useEffect(() => {
    if (!allowed) return
    api.get('/requests')
      .then((res) => setRequests(res.data?.data || []))
      .catch((err) => setError(errorText(err, 'Could not load the audit trail.')))
      .finally(() => setLoading(false))
  }, [allowed, user?.id])

  const setParam = (k, v) => {
    const next = new URLSearchParams(params)
    if (v == null) next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: k === 'view' })
  }

  if (!allowed) {
    return (
      <div className="card text-center">
        <ShieldAlert className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
        <p className="mt-2 text-sm text-slate-600">The audit trail is available to administrators and internal auditors.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Audit trail</h1>
          <p className="page-subtitle">Find any request and click it to see everything about it. Entries cannot be edited or deleted.</p>
        </div>
        <button type="button" onClick={() => setExportOpen(true)} className="btn-secondary self-start">
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Export to Excel
        </button>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="tablist" aria-label="Audit views">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setParam('view', v.key === 'turnaround' ? null : v.key)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === v.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <v.icon className="h-4 w-4" aria-hidden="true" /> {v.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
      ) : loading ? (
        <div className="card-flat"><LoadingSkeleton rows={6} /></div>
      ) : view === 'turnaround' ? (
        <TurnaroundView requests={requests} onOpen={(id) => setParam('r', id)} />
      ) : (
        <ActivityView requests={requests} onOpen={(id) => setParam('r', id)} />
      )}

      {openRequest && <AuditRequestPanel request={openRequest} user={user} onClose={() => setParam('r', null)} />}
      {exportOpen && <AdminAuditExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} requests={requests} user={user} />}
    </div>
  )
}
