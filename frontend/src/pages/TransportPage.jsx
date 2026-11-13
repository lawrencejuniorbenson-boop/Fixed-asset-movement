import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, Truck } from 'lucide-react'
import api from '../api/client'
import TaskList from '../components/TaskList'
import LoadingSkeleton from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import { useAuth, errorText } from '../context/AuthContext'

const TABS = [
  { key: 'open', label: 'Open', test: (t) => t.status !== 'completed' },
  { key: 'pending_assignment', label: 'Needs assignment', test: (t) => t.status === 'pending_assignment' },
  { key: 'officer_assigned', label: 'Scheduled', test: (t) => t.status === 'officer_assigned' },
  { key: 'in_progress', label: 'In transit', test: (t) => t.status === 'in_progress' },
  { key: 'completed', label: 'Delivered', test: (t) => t.status === 'completed' }
]

export default function TransportPage() {
  const { user } = useAuth()
  const location = useLocation()
  const isItView = location.pathname.startsWith('/it-logistics')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('open')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.get(isItView ? '/it-logistics' : '/transport')
      .then((res) => {
        if (cancelled) return
        const list = res.data?.data || []
        setTasks(list.filter((t) => (isItView ? t.fulfillment_type === 'it' : t.fulfillment_type !== 'it')))
      })
      .catch((err) => { if (!cancelled) setError(errorText(err, 'Could not load moves.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isItView, user?.id])

  const q = search.trim().toLowerCase()
  const current = TABS.find((t) => t.key === tab)
  const filtered = tasks.filter((t) => {
    if (!current.test(t)) return false
    if (!q) return true
    return [t.request?.reference_no, t.request?.present_location, t.request?.new_location, t.assigned_officer_name, t.vehicle_details,
      ...(t.items || []).map((i) => `${i.name_of_asset} ${i.asset_code}`)].join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{isItView ? 'IT' : 'Transport'}</h1>
        <p className="page-subtitle">
          Authorized movements for the {isItView ? 'IT' : 'Transport'} pool. Assign an officer, record the pickup, then confirm delivery.
        </p>
      </div>

      <div className="card-flat overflow-hidden">
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference, location, officer, vehicle or asset…"
              className="input-field pl-9"
              aria-label="Search moves"
            />
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Filter by status">
            {TABS.map((t) => {
              const active = t.key === tab
              const n = tasks.filter(t.test).length
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                  {!loading && <span className={`tabular-nums ${active ? 'text-slate-300' : 'text-slate-400'}`}>{n}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {error ? (
          <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
        ) : loading ? (
          <LoadingSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Truck} title={q ? 'No matching moves' : 'Nothing here'} description={q ? 'Try a different search.' : 'Moves appear here once the AMA pool authorizes a request.'} />
        ) : (
          <TaskList tasks={filtered} />
        )}
      </div>
    </div>
  )
}
