import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Clock, Truck, CheckCircle2, Plus, ArrowRight, Building2, FileClock, Trash2, Database, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import StatusBadge from '../components/StatusBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { isSupabaseConfigured, getSupabase } from '../lib/supabase'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [recentRequests, setRecentRequests] = useState([])
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [supabaseTablesReady, setSupabaseTablesReady] = useState(true)

  const loadData = async () => {
    try {
      const [statsRes, reqRes, draftRes] = await Promise.all([
        api.get('/requests/stats'),
        api.get('/requests'),
        api.get('/requests/draft')
      ])
      setStats(statsRes.data?.data || statsRes.data)
      const list = reqRes.data?.data || reqRes.data || []
      setRecentRequests(list.slice(0, 8))
      setDraft(draftRes.data?.data || null)
    } catch (err) {
      // error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    if (isSupabaseConfigured()) {
      const client = getSupabase()
      if (client) {
        client
          .from('movement_requests')
          .select('id', { count: 'exact', head: true })
          .then(({ error }) => {
            if (error && (error.message.includes('Could not find') || error.message.includes('does not exist'))) {
              setSupabaseTablesReady(false)
            } else {
              setSupabaseTablesReady(true)
            }
          })
          .catch(() => {})
      }
    }
  }, [user?.email, user?.role, user?.id])

  const handleDeleteDraft = async () => {
    if (!window.confirm('Discard this saved draft?')) return
    try {
      await api.delete('/requests/draft')
      setDraft(null)
    } catch {
      // error
    }
  }

  const role = user?.role
  const isRequester = role === 'requesting_officer'
  const isTransportRole = role === 'transport_head' || role === 'transport_officer'
  const isAssetAuthority = role === 'admin' || role === 'ama_officer' || role === 'ama_head'

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-blue-100 shadow-sm shadow-blue-500/5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl shrink-0 border border-blue-100">
            {isTransportRole ? <Truck className="w-6 h-6 text-blue-600" /> : <Building2 className="w-6 h-6 text-blue-600" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-blue-950 tracking-tight">
                {isTransportRole ? 'Transport & Fleet Logistics Service' : 'Fixed Asset Movement Service'}
              </h1>
              {isTransportRole && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Transport Department
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Welcome, <strong className="text-blue-900">{user?.name}</strong> &bull; {user?.department || 'Operations'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {(isRequester || role === 'admin') && (
            <Link to="/requests/new" className="btn-primary">
              <Plus className="w-4 h-4" />
              New Movement Request
            </Link>
          )}
        </div>
      </div>

      {/* Supabase Schema Notice Banner (shown if tables need 1-click execution in SQL editor) */}
      {!supabaseTablesReady && (
        <div className="bg-gradient-to-r from-blue-600 to-primary-700 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-wide">
                  Supabase Backend Connected (qtxkaizlfaaicgzcbkiv)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-white">
                  Live
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                Run the database schema once in your Supabase SQL Editor to initialize all tables (`movement_requests`, `movement_items`, etc.).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://supabase.com/dashboard/project/qtxkaizlfaaicgzcbkiv/sql/new"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-xs rounded-xl shadow-xs transition"
            >
              Open Supabase SQL Editor <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Saved Draft Alert Card (Only 1 draft max) */}
      {draft && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 border border-amber-200">
              <FileClock className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                  Uncompleted Request Draft in Progress
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900">
                  1 Draft Stored
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Purpose: <strong>"{draft.form?.purpose || 'Fixed Asset Relocation'}"</strong> &bull; {draft.items?.length || 0} item(s) itemized
                {draft.updated_at && ` • Last saved at ${new Date(draft.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDeleteDraft}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 transition"
              title="Discard this draft"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1" />
              Discard
            </button>
            <Link
              to="/requests/new"
              className="btn-primary py-1.5 px-3.5 text-xs bg-amber-700 hover:bg-amber-800 shadow-none"
            >
              Finish Draft &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      {loading ? (
        <LoadingSkeleton rows={1} cols={4} />
      ) : isRequester ? (
        /* Requesting Officer View: Clearly shows how many requests they have made */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">My Requests Made</p>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-950 mt-1.5">{stats?.my_requests_count ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Total requests initiated by you</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Pending Review</p>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-700 mt-1.5">{stats?.my_pending_count ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Awaiting approval</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">In Transport</p>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-sky-700 mt-1.5">{stats?.my_in_transport_count ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Authorized for physical move</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Completed</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-700 mt-1.5">{stats?.my_closed_count ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Relocated &amp; records closed</p>
          </div>
        </div>
      ) : (
        /* Admin, Asset Officer (AMA Officer), Head of Assets & Department Heads */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">All Requests</p>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-950 mt-1.5">{stats?.total ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Across all departments</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Pending Approvals</p>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-700 mt-1.5">{stats?.pending_approval ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Awaiting review or signoff</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">In Transport</p>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-sky-700 mt-1.5">{stats?.in_transport ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Active logistics relocation</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Records Closed</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-700 mt-1.5">{stats?.closed ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Asset register updated</p>
          </div>
        </div>
      )}

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-blue-50 flex items-center justify-between bg-gradient-to-r from-blue-50/30 to-white">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-950">
              {isRequester ? 'My Movement Requests' : 'Recent Movement Requests'}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isRequester
                ? `You have made ${stats?.my_requests_count ?? recentRequests.length} asset movement request${stats?.my_requests_count === 1 ? '' : 's'}`
                : isAssetAuthority
                ? 'Showing all requests across the organization'
                : 'Showing active movement requests'}
            </p>
          </div>
          <Link
            to="/requests"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
          >
            View all requests &rarr;
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-blue-950">No movement requests yet</p>
            <p className="text-xs text-slate-400 mt-1">
              {isRequester ? 'Click "New Movement Form" above to create your first request.' : 'Requests will appear here as they are submitted.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-blue-50/60 border-b border-blue-100 text-blue-900 font-semibold">
                <tr>
                  <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Reference</th>
                  <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Asset Items</th>
                  <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Route</th>
                  {!isRequester && (
                    <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Requesting Officer</th>
                  )}
                  <th className="text-left px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Status</th>
                  <th className="text-right px-6 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {recentRequests.map((req) => (
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
                    <td className="px-6 py-3.5 text-slate-600 text-[11px]">
                      <span className="text-slate-900 font-medium">{req.present_location}</span>
                      <span className="mx-1 text-blue-500 font-bold">&rarr;</span>
                      <span className="text-slate-900 font-medium">{req.new_location}</span>
                    </td>
                    {!isRequester && (
                      <td className="px-6 py-3.5 text-slate-600">
                        <span className="font-medium text-slate-900 block">{req.requester_name}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                          {req.requester_department}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-3.5">
                      <StatusBadge status={req.status} fulfillmentType={req.fulfillment_type || req.transport_task?.fulfillment_type} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/requests/${req.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 transition"
                      >
                        View &rarr;
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
