import { Check, X } from 'lucide-react'
import { STAGES, stageIndex } from '../lib/workflow'

/**
 * Where a request is in its lifecycle. Horizontal on wide screens, vertical on phones.
 */
export default function StageProgress({ request }) {
  const rejected = request.status === 'rejected'
  const closed = request.status === 'closed'
  // For a rejected request, show the stage where it stopped.
  const current = rejected
    ? (request.ama_officer_approved_at ? 2 : request.head_approved_at ? 1 : 0)
    : stageIndex(request.status)
  const steps = STAGES.slice(0, 6) // "Closed" is shown as the final state of the last step

  return (
    <ol className="grid gap-3 sm:grid-cols-6 sm:gap-2" aria-label="Request progress">
      {steps.map((s, i) => {
        const done = closed || i < current
        const isCurrent = !closed && i === current
        const failed = rejected && isCurrent
        const state = failed ? 'Rejected' : done ? 'Done' : isCurrent ? 'Current step' : 'Not started'
        return (
          <li key={s.status} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2" aria-current={isCurrent ? 'step' : undefined}>
            <div className="flex items-center gap-2 sm:w-full">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  failed ? 'bg-red-600 text-white'
                    : done ? 'bg-blue-600 text-white'
                    : isCurrent ? 'bg-white text-blue-700 ring-2 ring-blue-600'
                    : 'bg-slate-100 text-slate-400'
                }`}
                aria-hidden="true"
              >
                {failed ? <X className="h-3.5 w-3.5" /> : done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`hidden h-0.5 flex-1 rounded sm:block ${done ? 'bg-blue-600' : 'bg-slate-200'}`} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={`text-[13px] font-medium ${isCurrent ? (failed ? 'text-red-700' : 'text-slate-900') : done ? 'text-slate-700' : 'text-slate-400'}`}>
                {s.label}
              </p>
              <p className="text-xs text-slate-400">
                <span className="sr-only">{state}. </span>{s.owner}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
