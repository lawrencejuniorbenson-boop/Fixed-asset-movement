import { CheckCircle2, Clock, XCircle, Circle } from 'lucide-react'
import { calculateStageDurations } from '../utils/slaAnalytics'

const STAGES = [
  { key: 'head', title: '1. Requesting Department Head', desc: 'Departmental review & authorization by unit head' },
  { key: 'ama', title: '2. Asset Management & Archives Department', desc: 'Asset register & tag verification, then movement authorization (Department Pool)' },
  { key: 'transport', title: '3. Transport & Logistics Department', desc: 'Logistics allocation & physical relocation (Department Pool)' },
  { key: 'closure', title: '4. Asset Management & Archives Department', desc: 'Records updated in register & file closed (Department Pool)' }
]

function getStageState(request, key) {
  const s = request?.status
  if (!s) return 'pending'
  if (s === 'rejected') return 'rejected'

  if (key === 'head') {
    if (s === 'pending_head') return 'active'
    if (['head_approved', 'fully_approved', 'in_transport', 'transport_completed', 'closed'].includes(s)) return 'approved'
    return 'pending'
  }

  if (key === 'ama') {
    if (s === 'head_approved') return 'active'
    if (['fully_approved', 'in_transport', 'transport_completed', 'closed'].includes(s)) return 'approved'
    return 'pending'
  }

  if (key === 'transport') {
    if (s === 'fully_approved' || s === 'in_transport') return 'active'
    if (['transport_completed', 'closed'].includes(s)) return 'approved'
    return 'pending'
  }

  if (key === 'closure') {
    if (s === 'transport_completed') return 'active'
    if (s === 'closed') return 'approved'
    return 'pending'
  }

  return 'pending'
}

export default function ApprovalTimeline({ request }) {
  const analytics = calculateStageDurations(request)
  const isIt = request?.fulfillment_type === 'it' || request?.transport_task?.fulfillment_type === 'it'

  const stages = [
    { key: 'head', title: '1. Requesting Department Head', desc: 'Departmental review & authorization by unit head' },
    { key: 'ama', title: '2. Asset Management & Archives Department', desc: 'Asset register & tag verification, then movement authorization (Department Pool)' },
    {
      key: 'transport',
      title: isIt ? '3. IT Infrastructure & Systems Department' : '3. Transport & Logistics Department',
      desc: isIt
        ? 'IT hardware allocation, de-racking & physical transit (Department Pool)'
        : 'Logistics allocation & physical relocation (Department Pool)'
    },
    { key: 'closure', title: '4. Asset Management & Archives Department', desc: 'Records updated in register & file closed (Department Pool)' }
  ]

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => {
        const state = getStageState(request, stage.key)
        const isLast = idx === stages.length - 1

        let approver = null
        let timestamp = null
        let notes = null
        let stageDuration = null

        if (analytics?.stages) {
          if (stage.key === 'head') stageDuration = analytics.stages[0]?.durationFormatted
          else if (stage.key === 'ama') stageDuration = analytics.stages[1]?.durationFormatted
          else if (stage.key === 'transport') stageDuration = analytics.stages[2]?.durationFormatted || analytics.stages[3]?.durationFormatted
          else if (stage.key === 'closure') stageDuration = analytics.stages[4]?.durationFormatted
        }

        const isIt = request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it'

        if (stage.key === 'head') {
          approver = request.head_approver_name || request.authorized_by || 'Requesting Department Head'
          timestamp = request.head_approved_at
          notes = request.head_remarks
        } else if (stage.key === 'ama') {
          approver = request.ama_officer_name || request.ama_head_name || 'Asset Management & Archives Department'
          timestamp = request.ama_head_approved_at || request.ama_officer_approved_at
          notes = request.ama_head_remarks || request.ama_officer_remarks
        } else if (stage.key === 'transport') {
          const task = request.transport_task
          approver = isIt ? 'IT Infrastructure & Systems Department' : 'Transport & Logistics Department'
          timestamp = task?.completed_at || task?.scheduled_date
          notes = task?.completion_notes || task?.vehicle_details
        } else if (stage.key === 'closure') {
          approver = 'Asset Management & Archives Department'
          timestamp = request.ama_closed_at
          notes = request.ama_closing_remarks
        }

        return (
          <div key={stage.key} className="flex items-start gap-3.5">
            {/* Timeline icon & connector */}
            <div className="flex flex-col items-center">
              <div className="mt-0.5">
                {state === 'approved' && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
                {state === 'active' && (
                  <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
                )}
                {state === 'rejected' && (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                {state === 'pending' && (
                  <Circle className="w-5 h-5 text-slate-300" />
                )}
              </div>
              {!isLast && (
                <div
                  className={`w-px h-10 my-1 ${
                    state === 'approved' ? 'bg-emerald-300' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>

            {/* Stage content */}
            <div className="flex-1 pb-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900 tracking-tight">
                  {stage.title}
                </p>
                <div className="flex items-center gap-1.5">
                  {stageDuration && stageDuration !== '—' && (
                    <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-600" />
                      {state === 'active' ? `Pending: ${stageDuration}` : stageDuration}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      state === 'approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : state === 'active'
                        ? 'bg-blue-50 text-blue-700'
                        : state === 'rejected'
                        ? 'bg-rose-50 text-rose-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {state === 'approved'
                      ? 'Done'
                      : state === 'active'
                      ? 'In Progress'
                      : state === 'rejected'
                      ? 'Rejected'
                      : 'Pending'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{stage.desc}</p>

              {approver && (
                <div className="mt-1 text-[11px] text-slate-600 flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">{approver}</span>
                  {timestamp && (
                    <span className="text-[10px] text-slate-400">
                      {new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}

              {notes && (
                <p className="mt-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5 italic">
                  "{notes}"
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
