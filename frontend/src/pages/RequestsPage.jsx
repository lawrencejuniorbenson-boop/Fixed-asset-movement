import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Plus, FileSpreadsheet, FileText } from 'lucide-react'
import api from '../api/client'
import RequestTable from '../components/RequestTable'
import LoadingSkeleton from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import AdminAuditExportModal from '../components/AdminAuditExportModal'
import { useAuth, errorText } from '../context/AuthContext'
import { canCreateRequest, canSeeAudit, isRequester, nextAction, APPROVAL_STATUSES, MOVING_STATUSES } from '../lib/workflow'

const TABS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'action', label: 'Needs my action', test: (r, u) => !!nextAction(r, u) },
  { key: 'approval', label: 'In approval', test: (r) => APPROVAL_STATUSES.includes(r.status) },
  { key: 'moving', label: 'Being moved', test: (r) => MOVING_STATUSES.includes(r.status) },
  { key: 'done', label: 'Completed', test: (r) => ['transport_completed', 'closed'].includes(r.status) },
  { key: 'rejected', label: 'Rejected', test: (r) => r.status === 'rejected' }
]

export default function RequestsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(params.get('q') || '')
  const [exportOpen, setExportOpen] = useState(false)

  const tabs = isRequester(user) ? TABS.filter((t) => t.key !== 'action') : TABS
  const tab = tabs.find((t) => t.key === params.get('tab')) || tabs[0]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get('/requests')
      .then((res) => { if (!cancelled) setRequests(res.data?.data || []) })
      .catch((err) => { if (!cancelled) setError(errorText(err, 'Could not load requests.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.id, user?.role])

  const counts = useMemo(
    () => Object.fromEntries(tabs.map((t) => [t.key, requests.filter((r) => t.test(r, user)).length])),
    [requests, user, tabs]
  )

  const q = search.trim().toLowerCase()
  const filtered = requests.filter((r) => {
    if (!tab.test(r, user)) return false
    if (!q) return true
    const hay = [
      r.reference_no, r.present_location, r.new_location, r.purpose, r.requester_name, r.department,
      ...(r.items || []).flatMap((i) => [i.name_of_asset, i.asset_code])
    ].join(' ').toLowerCase()
    return hay.includes(q)
  })

  const selectTab = (key) => {
    const next = new URLSearchParams(params)
    if (key === 'all') next.delete('tab')
    else next.set('tab', key)
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">{isRequester(user) ? 'My requests' : 'Movement requests'}</h1>
          <p className="page-subtitle">Every request you're allowed to see, newest first.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSeeAudit(user) && (
            <button type="button" onClick={() => setExportOpen(true)} className="btn-secondary">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Export
            </button>
          )}
          {canCreateRequest(user) && (
            <Link to="/requests/new" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" /> New request
            </Link>
          )}
        </div>
      </div>

      <div className="card-flat overflow-hidden">
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference, location, asset name or code, requester…"
              className="input-field pl-9"
              aria-label="Search requests"
            />
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Filter by stage">
            {tabs.map((t) => {
              const active = t.key === tab.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(t.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                  {!loading && (
                    <span className={`tabular-nums ${active ? 'text-slate-300' : 'text-slate-400'}`}>{counts[t.key]}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {error ? (
          <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
        ) : loading ? (
          <LoadingSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={q ? 'No matching requests' : 'Nothing here yet'}
            description={q ? 'Try a different search or filter.' : tab.key === 'action' ? 'Nothing is waiting for you.' : undefined}
          />
        ) : (
          <RequestTable requests={filtered} showRequester={!isRequester(user)} />
        )}
      </div>

      {exportOpen && <AdminAuditExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} requests={requests} user={user} />}
    </div>
  )
}
