import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { PriorityTag } from './RequestList'
import { formatDate } from '../lib/format'

/**
 * Requests as a real table on wide screens (one column per fact) and as
 * stacked cards on phones. `actionFor(request)` optionally adds a
 * "What to do" column (used by "Needs your action").
 */
export default function RequestTable({ requests, showRequester = true, actionFor, empty = 'No requests to show.' }) {
  const navigate = useNavigate()
  if (!requests?.length) return <p className="px-5 py-10 text-center text-sm text-slate-500">{empty}</p>

  const items = (r) => r.items || []
  const firstItem = (r) => items(r)[0]

  return (
    <>
      {/* Desktop / tablet: fixed-width columns, long text truncates instead of overflowing */}
      <div className="hidden md:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[9.5rem]" />
            <col />
            <col />
            {showRequester && <col className="hidden w-[11rem] lg:table-column" />}
            <col className="w-[13.5rem]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th scope="col" className="px-5 py-2.5 font-medium">Reference</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Assets</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Route</th>
              {showRequester && <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">Requested by</th>}
              <th scope="col" className="px-3 py-2.5 pr-5 font-medium">{actionFor ? 'What to do' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((r) => {
              const it = firstItem(r)
              const href = r.__href || `/requests/${r.id}`
              return (
                <tr key={r.id} onClick={() => navigate(href)} className="cursor-pointer align-top transition-colors hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <Link to={href} className="font-mono text-[13px] font-medium text-slate-900 hover:text-blue-700" onClick={(e) => e.stopPropagation()}>
                      {r.reference_no}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(r.movement_date)}</p>
                    {(r.__kind || ['High', 'Urgent', 'Critical'].includes(r.priority)) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <PriorityTag priority={r.priority} />
                        {r.__kind && <span className="badge badge-gray">{r.__kind}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    <p className="truncate font-medium text-slate-900" title={it?.name_of_asset}>{it?.name_of_asset || '—'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {it?.asset_code ? <span className="font-mono">{it.asset_code}</span> : null}
                      {items(r).length > 1 && <span>{it?.asset_code ? ' · ' : ''}+{items(r).length - 1} more</span>}
                    </p>
                  </td>
                  <td className="px-3 py-3.5">
                    <p className="truncate text-slate-700" title={r.present_location}>{r.present_location || '—'}</p>
                    <p className="flex min-w-0 items-center gap-1 text-slate-700" title={r.new_location}>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="to" />
                      <span className="truncate">{r.new_location || '—'}</span>
                    </p>
                  </td>
                  {showRequester && (
                    <td className="hidden px-3 py-3.5 lg:table-cell">
                      <p className="truncate text-slate-900">{r.requester_name}</p>
                      {r.requester_department && <p className="truncate text-xs text-slate-500">{r.requester_department}</p>}
                    </td>
                  )}
                  <td className="px-3 py-3.5 pr-5">
                    {actionFor ? (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                        <span className="truncate">{actionFor(r)}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      </span>
                    ) : (
                      <StatusBadge status={r.status} fulfillmentType={r.fulfillment_type} className="max-w-full" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {requests.map((r) => {
          const it = firstItem(r)
          return (
            <li key={r.id}>
              <Link to={r.__href || `/requests/${r.id}`} className="block px-4 py-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-[13px] font-medium text-slate-900">{r.reference_no}</span>
                  {actionFor ? (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">{actionFor(r)}</span>
                  ) : (
                    <StatusBadge status={r.status} fulfillmentType={r.fulfillment_type} />
                  )}
                </div>
                <p className="mt-2 font-medium text-slate-900">
                  {it?.name_of_asset || '—'}
                  {items(r).length > 1 && <span className="font-normal text-slate-500"> +{items(r).length - 1} more</span>}
                </p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                  <dt className="text-slate-500">From</dt><dd className="text-slate-700">{r.present_location || '—'}</dd>
                  <dt className="text-slate-500">To</dt><dd className="text-slate-700">{r.new_location || '—'}</dd>
                  <dt className="text-slate-500">Move date</dt><dd className="text-slate-700">{formatDate(r.movement_date)}</dd>
                  {showRequester && <><dt className="text-slate-500">By</dt><dd className="text-slate-700">{r.requester_name}</dd></>}
                </dl>
                {(r.priority === 'Urgent' || r.priority === 'Critical' || r.priority === 'High' || r.__kind) && (
                  <div className="mt-2 flex gap-1"><PriorityTag priority={r.priority} />{r.__kind && <span className="badge badge-gray">{r.__kind}</span>}</div>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
