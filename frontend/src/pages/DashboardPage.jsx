import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileClock, Trash2, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAuth, errorText } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import api from '../api/client'
import RequestList from '../components/RequestList'
import TaskList from '../components/TaskList'
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

function Stat({ label, value, hint }) {
  return (
    <div className="card-flat p-4 sm:p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
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

  const mine = isRequester(user) ? requests : requests.filter((r) => String(r.requesting_officer_id) === String(user?.id))
  const scope = isRequester(user) ? mine : requests
  const actionable = requests.filter((r) => nextAction(r, user))
  const openTasks = tasks.filter((t) => t.status !== 'completed' && canWorkTask(t, user))
  const firstName = (user?.name || '').split(' ')[0]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">{greeting()}, {firstName}</h1>
          <p className="page-subtitle">{roleLabel(user?.role)}{user?.department ? ` · ${user.department}` : ''}</p>
        </div>
        {canCreateRequest(user) && (
          <Link to="/requests/new" className="btn-primary self-start sm:self-auto">
            <Plus className="h-4 w-4" aria-hidden="true" /> New request
          </Link>
        )}
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

      {/* What needs this person's attention comes first */}
      {(actionable.length > 0 || openTasks.length > 0 || !loading) && !isRequester(user) && (
        <section aria-labelledby="todo">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="todo" className="section-title">Needs your action</h2>
            {actionable.length + openTasks.length > 0 && (
              <span className="badge badge-blue">{actionable.length + openTasks.length}</span>
            )}
          </div>
          <div className="card-flat overflow-hidden">
            {loading ? (
              <LoadingSkeleton rows={2} />
            ) : actionable.length === 0 && openTasks.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-600">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                You're all caught up. Nothing is waiting for you.
              </div>
            ) : (
              <>
                {actionable.length > 0 && <RequestList requests={actionable} showRequester />}
                {openTasks.length > 0 && (
                  <div className={actionable.length ? 'border-t border-slate-100' : ''}>
                    <TaskList tasks={openTasks} />
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label={isRequester(user) ? 'My requests' : 'All requests'} value={loading ? '–' : scope.length} />
        <Stat label="Awaiting approval" value={loading ? '–' : scope.filter((r) => APPROVAL_STATUSES.includes(r.status)).length} />
        <Stat label="Being moved" value={loading ? '–' : scope.filter((r) => MOVING_STATUSES.includes(r.status)).length} />
        <Stat label="Completed" value={loading ? '–' : scope.filter((r) => ['transport_completed', 'closed'].includes(r.status)).length} />
      </section>

      <section aria-labelledby="recent">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent" className="section-title">{isRequester(user) ? 'My recent requests' : 'Recent requests'}</h2>
          <Link to="/requests" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800">
            View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="card-flat overflow-hidden">
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <RequestList
              requests={scope.slice(0, 6)}
              showRequester={!isRequester(user)}
              empty={canCreateRequest(user) ? 'No requests yet. Start one with “New request”.' : 'No requests to show.'}
            />
          )}
        </div>
      </section>
    </div>
  )
}
