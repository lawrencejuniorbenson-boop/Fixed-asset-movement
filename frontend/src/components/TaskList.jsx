import { Link } from 'react-router-dom'
import { ChevronRight, CalendarDays, UserRound } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { Route } from './RequestList'
import { formatDate } from '../lib/format'

export const taskPath = (t) => `/${t.fulfillment_type === 'it' ? 'it-logistics' : 'transport'}/${t.id}`

export default function TaskList({ tasks, empty = 'No moves here.' }) {
  if (!tasks?.length) return <p className="px-5 py-10 text-center text-sm text-slate-500">{empty}</p>
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => (
        <li key={t.id}>
          <Link to={taskPath(t)} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-medium text-slate-900">{t.request?.reference_no || `Task ${t.id}`}</span>
                <StatusBadge status={t.status} />
                <span className="badge badge-gray">{t.fulfillment_type === 'it' ? 'IT' : 'Transport'}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                <Route from={t.request?.present_location} to={t.request?.new_location} />
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{formatDate(t.scheduled_date)}</span>
                <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" aria-hidden="true" />{t.assigned_officer_name || 'Not assigned'}</span>
                <span>{(t.items || []).length} item{(t.items || []).length === 1 ? '' : 's'}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
