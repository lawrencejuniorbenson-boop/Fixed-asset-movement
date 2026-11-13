import { statusLabel, statusTone } from '../lib/workflow'

export default function StatusBadge({ status, fulfillmentType, className = '' }) {
  const tone = statusTone(status)
  const dot = { amber: 'bg-amber-500', blue: 'bg-blue-500', green: 'bg-emerald-500', red: 'bg-red-500', gray: 'bg-slate-400' }[tone]
  return (
    <span className={`badge badge-${tone} ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="truncate">{statusLabel(status, fulfillmentType)}</span>
    </span>
  )
}
