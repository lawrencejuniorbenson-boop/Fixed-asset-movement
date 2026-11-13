import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, FileClock, Trash2, CheckCircle2, ArrowRight, Boxes, FileText, Clock, Truck, BadgeCheck, ListChecks
} from 'lucide-react'
import { useAuth, errorText } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import api from '../api/client'
import RequestTable from '../components/RequestTable'
import { taskPath } from '../components/TaskList'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { timeAgo } from '../lib/format'
import {
  roleLabel, nextAction, canCreateRequest, isRequester, isTransport, isIt, isAdmin,
  APPROVAL_STATUSES, MOVING_STATUSES, canWorkTask
} from '../lib/workflow'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// Brand: royal blue accents on white, blue-black numbers.
const TONES = {
  blue: { chip: 'bg-blue-600 text-white', label: 'text-slate-600' },
  amber: { chip: 'bg-blue-50 text-blue-700', label: 'text-slate-600' },
  sky: { chip: 'bg-blue-50 text-blue-700', label: 'text-slate-600' },
  green: { chip: 'bg-blue-50 text-blue-700', label: 'text-slate-600' }
}

function StatCard({ to, icon: Icon, tone, label, value, caption, loading }) {
  const t = TONES[tone]
  return (
    <Link to={to} className="card-flat group block p-4 transition hover:border-slate-300 hover:shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className={`text-[13px] font-medium ${t.label}`}>{label}</p>
        <span className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex ${t.chip}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-navy-900 sm:text-3xl">{loading ? '–' : value}</p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </Link>
  )
}

// One row per stage: how many requests sit there right now (single-hue bars).
function Pipeline({ requests, loading }) {
  const count = (statuses) => requests.filter((r) => statuses.includes(r.status)).length
  const rows = [
    { label: 'Department approval', n: count(['pending_head']), tab: 'approval' },
    { label: 'AMA approval', n: count(['head_approved', 'ama_officer_approved']), tab: 'approval' },
    { label: 'Awaiting pickup', n: count(['fully_approved']), tab: 'moving' },
    { label: 'In transit', n: count(['in_transport']), tab: 'moving' },
    { label: 'Register update', n: count(['transport_completed']), tab: 'done' },
    { label: 'Closed', n: count(['closed']), tab: 'done', muted: true },
    { label: 'Rejected', n: count(['rejected']), tab: 'rejected', muted: true }
  ]
  const max = Math.max(1, ...rows.map((r) => r.n))

  return (
    <section className="card-flat flex flex-col" aria-labelledby="pipeline-title">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 id="pipeline-title" className="section-title">Pipeline</h2>
        <p className="text-xs text-slate-500">Where requests are right now</p>
      </div>
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <ul className="flex-1 space-y-1 p-3">
          {rows.map((r) => (
            <li key={r.label}>
              <Link
                to={`/requests?tab=${r.tab}`}
                className="group grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={`${r.label}: ${r.n} request${r.n === 1 ? '' : 's'}`}
              >
                <span className={`truncate text-[13px] ${r.muted ? 'text-slate-500' : 'text-slate-700'}`}>{r.label}</span>
                <span className="h-2 rounded-full bg-slate-100" aria-hidden="true">
                  <span
                    className={`block h-2 rounded-full ${r.muted ? 'bg-slate-300' : 'bg-blue-500'}`}
                    style={{ width: r.n ? `${Math.max(6, (r.n / max) * 100)}%` : 0 }}
                  />
                </span>
                <span className="text-right text-[13px] font-medium tabular-nums text-slate-900">{r.n}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const TASK_STEP = {
  pending_assignment: 'Schedule the move',
  officer_assigned: 'Record the pickup',
  in_progress: 'Confirm delivery'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [requests, setRequests] = useState([])
  const [tasks, setTasks] = useState([])
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const poolRole = isTransport(user) || isIt(user)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const calls = [api.get('/requests'), api.get('/requests/draft')]
        if (poolRole || isAdmin(user)) calls.push(api.get(isIt(user) ? '/it-logistics' : '/transport'))
        const [reqRes, draftRes, taskRes] = await Promise.all(calls)
        if (cancelled) return
        setRequests(reqRes.data?.data || [])
        setDraft(draftRes.data?.data || null)
        setTasks(taskRes?.data?.data || [])
      } catch (err) {
        if (!cancelled) setLoadError(errorText(err, 'Could not load your dashboard.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.id, user?.role, poolRole])

  const discardDraft = async () => {
    if (!window.confirm('Discard your saved draft?')) return
    try {
      await api.delete('/requests/draft')
      setDraft(null)
      toast.success('Draft discarded.')
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  const requester = isRequester(user)
  const scope = requester ? requests : requests
  const actionable = requests.filter((r) => nextAction(r, user))
  const openTasks = tasks.filter((t) => t.status !== 'completed' && canWorkTask(t, user))

  // Requests and moves that need this person, shown in one table.
  const todo = [
    ...actionable.map((r) => ({ ...r, __action: nextAction(r, user).label })),
    ...openTasks.map((t) => ({
      ...(t.request || {}),
      id: `task-${t.id}`,
      items: t.items || [],
      movement_date: t.scheduled_date || t.request?.movement_date,
      __href: taskPath(t),
      __kind: t.fulfillment_type === 'it' ? 'IT' : 'Transport',
      __action: TASK_STEP[t.status] || 'Open'
    }))
  ]

  const counts = {
    all: scope.length,
    approval: scope.filter((r) => APPROVAL_STATUSES.includes(r.status)).length,
    moving: scope.filter((r) => MOVING_STATUSES.includes(r.status)).length,
    done: scope.filter((r) => ['transport_completed', 'closed'].includes(r.status)).length,
    rejected: scope.filter((r) => r.status === 'rejected').length
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-blue-900 p-6 text-white shadow-card sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
              <Boxes className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-blue-200">{greeting()},</p>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{user?.name}</h1>
              <p className="mt-0.5 text-sm text-blue-100/80">
                {roleLabel(user?.role)}{user?.department ? ` · ${user.department}` : ''}
              </p>
            </div>
          </div>
          {canCreateRequest(user) && (
            <Link to="/requests/new" className="btn-light self-start sm:self-auto">
              <Plus className="h-4 w-4" aria-hidden="true" /> New movement request
            </Link>
          )}
        </div>
      </div>

      {draft && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-amber-900">You have an unfinished request</p>
              <p className="text-sm text-amber-800">
                {draft.form?.purpose ? `“${draft.form.purpose}” · ` : ''}
                {(draft.items || []).filter((i) => i.name_of_asset).length} item(s)
                {draft.updated_at ? ` · saved ${timeAgo(draft.updated_at)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={discardDraft} className="btn-ghost btn-sm text-amber-900 hover:bg-amber-100">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Discard
            </button>
            <Link to="/requests/new" className="btn-primary btn-sm">Continue</Link>
          </div>
        </div>
      )}

      {loadError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{loadError}</p>}

      {/* Key numbers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-2">
        <StatCard to="/requests" icon={FileText} tone="blue" loading={loading}
          label={requester ? 'My requests' : 'All requests'} value={counts.all}
          caption={counts.rejected ? `${counts.rejected} rejected` : requester ? 'Requests you have made' : 'Across all departments'} />
        <StatCard to="/requests?tab=approval" icon={Clock} tone="amber" loading={loading}
          label="Awaiting approval" value={counts.approval} caption="Department head or AMA pool" />
        <StatCard to="/requests?tab=moving" icon={Truck} tone="sky" loading={loading}
          label="Being moved" value={counts.moving} caption="Awaiting pickup or in transit" />
        <StatCard to="/requests?tab=done" icon={BadgeCheck} tone="green" loading={loading}
          label="Completed" value={counts.done} caption="Delivered or closed in the register" />
      </section>

        <Pipeline requests={scope} loading={loading} />
      </div>

      {/* What needs attention */}
        <section className="card-flat min-w-0 overflow-hidden" aria-labelledby="todo-title">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="todo-title" className="section-title">Needs your action</h2>
              <p className="text-xs text-slate-500">Requests and moves waiting for you</p>
            </div>
            {!loading && todo.length > 0 && <span className="badge badge-blue">{todo.length}</span>}
          </div>
          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : todo.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-8 text-sm text-slate-600">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              {requester ? 'Nothing needs you right now. Your requests are with the approvers.' : "You're all caught up. Nothing is waiting for you."}
            </div>
          ) : (
            <RequestTable requests={todo} actionFor={(r) => r.__action} />
          )}
        </section>

      {!loading && isAdmin(user) && (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" /> As an administrator you can act on every stage.
        </p>
      )}
    </div>
  )
}
