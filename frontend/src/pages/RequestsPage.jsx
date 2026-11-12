import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, ArrowRight, Clock, CheckCircle2, FileSpreadsheet, Download } from 'lucide-react'
import api from '../api/axios'
import StatusBadge from '../components/StatusBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import AdminAuditExportModal from '../components/AdminAuditExportModal'
import { useAuth } from '../context/AuthContext'
import { calculateStageDurations } from '../utils/slaAnalytics'

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending_head', label: 'Pending Unit Head' },
  { value: 'head_approved', label: 'Asset Verification (AMA Pool)' },
  { value: 'ama_officer_approved', label: 'Final Authorization (AMA Pool)' },
  { value: 'fully_approved', label: 'Awaiting Logistics (Transport / IT Pool)' },
  { value: 'in_transport', label: 'Relocation in Progress (Transport / IT Pool)' },
  { value: 'transport_completed', label: 'Relocated • Awaiting Closure (AMA Pool)' },
  { value: 'closed', label: 'Closed & Registered' },
  { value: 'rejected', label: 'Rejected' }
]

export default function RequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [exportModalOpen, setExportModalOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/requests')
        const list = res.data?.data || res.data || []
        setRequests(list)
      } catch {
        // error
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.email, user?.role, user?.id])

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase()
    const matchStatus = !statusFilter || r.status === statusFilter
    const itemsText = (r.items || []).map(i => `${i.name_of_asset} ${i.asset_code}`).join(' ')
    const matchSearch =
      !q ||
      (r.reference_no || '').toLowerCase().includes(q) ||
      (r.present_location || '').toLowerCase().includes(q) ||
      (r.new_location || '').toLowerCase().includes(q) ||
      (r.purpose || '').toLowerCase().includes(q) ||
      (r.requester_name || '').toLowerCase().includes(q) ||
      itemsText.toLowerCase().includes(q)

    return matchStatus && matchSearch
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Movement Requests
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage multi-tier asset movement authorizations
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(user?.role === 'admin' || user?.role === 'auditor') && (
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-semibold text-xs shadow-xs transition"
              title="Audit & Compliance: Export institutional audit logs for a period into Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Audit Log (Period)</span>
            </button>
          )}

          {(user?.role === 'requesting_officer' || user?.role === 'admin') && (
            <Link to="/requests/new" className="btn-primary">
              <Plus className="w-4 h-4" />
              New Request
            </Link>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, asset name, tag code, location..."
            className="input-field pl-9 text-xs"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field pl-9 pr-8 text-xs sm:w-56 cursor-pointer"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingSkeleton rows={5} cols={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-blue-950">No requests found</p>
            <p className="text-xs text-slate-400 mt-1">Submit a movement request or adjust your search filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-blue-50/60 border-b border-blue-100 text-blue-900 font-semibold">
                <tr>
                  <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Reference</th>
                  <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Asset Items</th>
                  <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Route</th>
                  <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Requester</th>
                  <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Status</th>
                  <th className="text-right px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 bg-white">
                {filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-blue-50/40 transition">
                    <td className="px-6 py-3.5 font-mono font-semibold text-blue-950">
                      {req.reference_no}
                      {req.priority === 'Urgent' && (
                        <span className="block text-[10px] font-semibold text-rose-600">Urgent</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-700">
                      <span className="font-medium text-slate-900 block truncate max-w-xs">
                        {req.items && req.items.length > 0 ? req.items[0].name_of_asset : 'Asset'}
                        {req.items?.length > 1 && (
                          <span className="text-blue-600 font-normal ml-1">
                            (+{req.items.length - 1} more)
                          </span>
                        )}
                      </span>
                      {req.items && req.items.length > 0 && (
                        <span className="text-[10px] font-mono text-slate-400 block">
                          Tag: {req.items[0].asset_code}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 text-[11px] max-w-xs">
                      <span className="font-medium text-slate-900">{req.present_location}</span>
                      <span className="text-blue-400 mx-1">&rarr;</span>
                      <span className="font-medium text-slate-900">{req.new_location}</span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      <span className="font-medium text-slate-900 block">{req.requester_name}</span>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                        {req.requester_department}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={req.status} fulfillmentType={req.fulfillment_type || req.transport_task?.fulfillment_type} />
                      {(() => {
                        const durations = calculateStageDurations(req, req.audit_log || [])
                        const activeStage = durations.stages.find(s => s.status === 'currently_pending')
                        if (activeStage) {
                          const isBreached = activeStage.duration_ms > (activeStage.target_sla_hours * 3600 * 1000)
                          return (
                            <span
                              title={`Current stage target SLA: < ${activeStage.target_sla_hours}h`}
                              className={`flex items-center gap-1 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border w-fit ${
                                isBreached
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-blue-50/80 text-blue-700 border-blue-200/60'
                              }`}
                            >
                              <Clock className={`w-2.5 h-2.5 ${isBreached ? 'text-rose-500' : 'text-blue-500'}`} />
                              Pended: {activeStage.duration_formatted}
                            </span>
                          )
                        }
                        if (req.status === 'closed' && durations.total_turnaround_time_formatted) {
                          return (
                            <span className="flex items-center gap-1 mt-1 text-[10px] text-emerald-700 font-medium bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-200/60 w-fit">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              TAT: {durations.total_turnaround_time_formatted}
                            </span>
                          )
                        }
                        return null
                      })()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        {req.status === 'closed' && (
                          <Link
                            to={`/requests/${req.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition"
                            title="Download Completed Official Movement Form (PDF)"
                          >
                            <Download className="w-3 h-3 text-emerald-600" />
                            PDF
                          </Link>
                        )}
                        <Link
                          to={`/requests/${req.id}`}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                        >
                          View &rarr;
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin & Auditor Periodic Audit Export Modal */}
      {(user?.role === 'admin' || user?.role === 'auditor') && (
        <AdminAuditExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          requests={requests}
          user={user}
        />
      )}
    </div>
  )
}
