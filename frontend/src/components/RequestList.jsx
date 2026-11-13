import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { formatDate } from '../lib/format'

function itemsSummary(items = []) {
  if (!items.length) return 'No items listed'
  const first = items[0]?.name_of_asset || 'Asset'
  return items.length === 1 ? first : `${first} +${items.length - 1} more`
}

export function Route({ from, to, className = '' }) {
  return (
    <span className={`inline-flex min-w-0 flex-wrap items-center gap-x-1.5 ${className}`}>
      <span className="truncate">{from || '—'}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="to" />
      <span className="truncate">{to || '—'}</span>
    </span>
  )
}

export function PriorityTag({ priority }) {
  if (!priority || priority === 'Normal' || priority === 'Low') return null
  const cls = priority === 'Urgent' ? 'badge-red' : 'badge-amber'
  return <span className={`badge ${cls}`}>{priority}</span>
}

/**
 * Responsive list of movement requests: rows on desktop, stacked cards on phones.
 */
export default function RequestList({ requests, showRequester = false, empty = 'No requests yet.' }) {
  if (!requests?.length) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">{empty}</p>
  }
  return (
    <ul className="divide-y divide-slate-100">
      {requests.map((r) => (
        <li key={r.id}>
          <Link
            to={`/requests/${r.id}`}
            className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-medium text-slate-900">{r.reference_no}</span>
                <StatusBadge status={r.status} fulfillmentType={r.fulfillment_type} />
                <PriorityTag priority={r.priority} />
              </div>
              <p className="mt-1 truncate text-sm text-slate-700">{itemsSummary(r.items)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <Route from={r.present_location} to={r.new_location} className="max-w-full" />
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span>Move date {formatDate(r.movement_date)}</span>
                {showRequester && r.requester_name && (
                  <>
                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                    <span>{r.requester_name}</span>
                  </>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
