import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Search, Truck, ArrowRight, ClipboardList, Server } from 'lucide-react'
import api from '../api/axios'
import StatusBadge from '../components/StatusBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { useAuth } from '../context/AuthContext'

export default function TransportPage() {
  const { user } = useAuth()
  const location = useLocation()
  const isItPath = location.pathname.startsWith('/it-logistics') || user?.role === 'it_head' || user?.role === 'it_officer'
  const isTransportRole = user?.role === 'transport_head' || user?.role === 'transport_officer'
  const isItRole = user?.role === 'it_head' || user?.role === 'it_officer'
  const canSwitchPools = user?.role === 'admin' || user?.role === 'auditor'

  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [poolFilter, setPoolFilter] = useState(isItPath || isItRole ? 'it' : (isTransportRole ? 'transport' : 'all'))

  useEffect(() => {
    if (location.pathname.startsWith('/it-logistics') || isItRole) {
      setPoolFilter('it')
    } else if (location.pathname.startsWith('/transport') && !isItRole) {
      setPoolFilter(isTransportRole ? 'transport' : (canSwitchPools ? 'all' : 'transport'))
    }
  }, [location.pathname, user?.role])

  const fetchUrl = (poolFilter === 'it' || location.pathname.startsWith('/it-logistics')) ? '/it-logistics' : '/transport'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get(fetchUrl)
        const list = res.data?.data || res.data || []
        setTasks(list)
      } catch {
        // error
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchUrl, user?.email, user?.role, user?.id])

  const filtered = tasks.filter((t) => {
    const q = search.toLowerCase()
    const isIt = t.fulfillment_type === 'it'
    if (poolFilter === 'transport' && isIt) return false
    if (poolFilter === 'it' && !isIt) return false
    if (poolFilter === 'it' && !isIt) return false

    const ref = t.request?.reference_no || t.reference_no || ''
    const officer = t.assigned_officer_name || ''
    const fromLoc = t.request?.present_location || ''
    const toLoc = t.request?.new_location || ''
    const items = (t.items || []).map(i => i.name_of_asset).join(' ')
    return (
      !q ||
      ref.toLowerCase().includes(q) ||
      officer.toLowerCase().includes(q) ||
      fromLoc.toLowerCase().includes(q) ||
      toLoc.toLowerCase().includes(q) ||
      items.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            {poolFilter === 'it' ? (
              <>
                <Server className="w-5 h-5 text-indigo-600 inline" />
                <span>IT Equipment Logistics Execution</span>
              </>
            ) : (
              <>
                <Truck className="w-5 h-5 text-blue-600 inline" />
                <span>Transport &amp; Logistics Execution</span>
              </>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {poolFilter === 'it'
              ? 'Assign IT hardware specialists, schedule technical de-rack/transit, and manage secure server movement'
              : 'Assign transport officers, schedule relocation dates, and specify vehicle and driver arrangements'}
          </p>
        </div>

        {/* Pool Filter Tabs or Dedicated Department Badge */}
        {canSwitchPools ? (
          <div className="flex items-center p-1 bg-blue-50/80 rounded-xl border border-blue-200 text-xs">
            <button
              type="button"
              onClick={() => setPoolFilter('all')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition ${
                poolFilter === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-900 hover:text-blue-950'
              }`}
            >
              All Logistics ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setPoolFilter('transport')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition ${
                poolFilter === 'transport' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-900 hover:text-blue-950'
              }`}
            >
              Transport Pool ({tasks.filter(t => t.fulfillment_type !== 'it').length})
            </button>
            <button
              type="button"
              onClick={() => setPoolFilter('it')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition ${
                poolFilter === 'it' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-900 hover:text-blue-950'
              }`}
            >
              IT Hardware ({tasks.filter(t => t.fulfillment_type === 'it').length})
            </button>
          </div>
        ) : (
          <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
            poolFilter === 'it' ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            {poolFilter === 'it' ? <Server className="w-4 h-4 text-indigo-600" /> : <Truck className="w-4 h-4 text-blue-600" />}
            <span>{poolFilter === 'it' ? 'IT Infrastructure Pool Active' : 'Transport Pool Active'}</span>
          </div>
        )}
      </div>

      {/* Header Stat Pill */}
      <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-xl border border-blue-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            poolFilter === 'it' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'
          }`}>
            {poolFilter === 'it' ? <Server className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
          </div>
          <span className="text-xs font-semibold text-blue-950">
            {poolFilter === 'it' ? 'Active IT Infrastructure Hardware Relocations' : 'Active Transport & Logistics Relocations'}
          </span>
        </div>
        <span className={`px-2.5 py-1 rounded-md font-semibold text-xs border ${
          poolFilter === 'it' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {tasks.length} Total Task{tasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by task #, route, officer..."
          className="input-field pl-9 text-xs"
        />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8"><LoadingSkeleton rows={5} cols={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Truck className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">No transport tasks found</p>
            <p className="text-xs text-slate-400 mt-1">Tasks appear here automatically once requests are authorized by Head, Fixed Assets.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-blue-50/70 border-b border-blue-100 text-blue-900">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold uppercase text-[10px] tracking-wider">Task &amp; Ref</th>
                  <th className="text-left px-6 py-3 font-semibold uppercase text-[10px] tracking-wider">Asset Items</th>
                  <th className="text-left px-6 py-3 font-semibold uppercase text-[10px] tracking-wider">Route</th>
                  <th className="text-left px-6 py-3 font-semibold uppercase text-[10px] tracking-wider">Assigned Details</th>
                  <th className="text-left px-6 py-3 font-semibold uppercase text-[10px] tracking-wider">Status</th>
                  <th className="text-right px-6 py-3 font-semibold uppercase text-[10px] tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50/80">
                {filtered.map((task) => (
                  <tr key={task.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-6 py-3.5 font-mono font-medium text-slate-900">
                      <span className="text-blue-700 font-semibold">Task #{task.id}</span>
                      <span className="block text-[11px] font-normal text-slate-500">
                        {task.request?.reference_no || 'FAM-REQ'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-700">
                      <span className="font-medium text-slate-900 block truncate max-w-xs">
                        {task.items && task.items.length > 0 ? (
                          <>
                            {task.items[0].name_of_asset}
                            {task.items.length > 1 && (
                              <span className="text-blue-600 font-medium ml-1">
                                (+{task.items.length - 1} more)
                              </span>
                            )}
                          </>
                        ) : (
                          'Assets'
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 text-[11px] max-w-xs">
                      <span className="font-medium text-slate-800">{task.request?.present_location}</span>
                      <span className="text-blue-600 mx-1 font-bold">&rarr;</span>
                      <span className="text-slate-800 font-medium">{task.request?.new_location}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-slate-900 block">
                        {task.assigned_officer_name || <span className="text-amber-600 italic">Pending Assignment</span>}
                      </span>
                      {task.vehicle_details && (
                        <span className="text-[11px] text-blue-700 font-medium block truncate max-w-xs">
                          {task.vehicle_details}
                        </span>
                      )}
                      {task.driver_name && (
                        <span className="text-[10px] text-slate-500 block truncate max-w-xs">
                          Driver: {task.driver_name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={task.status} fulfillmentType={task.fulfillment_type} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={task.fulfillment_type === 'it' ? `/it-logistics/${task.id}` : `/transport/${task.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 transition"
                      >
                        Manage <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
