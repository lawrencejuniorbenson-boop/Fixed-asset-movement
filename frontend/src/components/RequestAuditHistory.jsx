import { useState } from 'react'
import {
  Clock, CheckCircle2, XCircle, AlertCircle, Calendar,
  User, ShieldCheck, ArrowRight, Hourglass, Activity,
  ChevronDown, ChevronUp, FileText, Truck, Server, Building2, FileSpreadsheet
} from 'lucide-react'
import { calculateStageDurations, formatDuration } from '../utils/slaAnalytics'
import { exportSingleRequestAuditToExcel } from '../utils/excelExporter'
import { useAuth } from '../context/AuthContext'
import StatusBadge from './StatusBadge'

export default function RequestAuditHistory({ request, auditLog = [] }) {
  const { user } = useAuth()
  const [filterType, setFilterType] = useState('all') // 'all' | 'approvals' | 'transport'
  const [showRawLogs, setShowRawLogs] = useState(false)

  const analytics = calculateStageDurations(request, auditLog)
  if (!analytics) return null

  const {
    stages,
    totalDurationFormatted,
    currentStage,
    currentStagePendingFormatted,
    completedCount,
    totalStages,
    slowestStage,
    isClosed,
    isRejected
  } = analytics

  const rawLogs = (analytics.auditLogs || []).sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )

  // Calculate elapsed time from previous log for every audit log entry
  const enrichedLogs = rawLogs.map((log, index) => {
    let elapsedFromPrev = null
    if (index > 0) {
      const prevTime = new Date(rawLogs[index - 1].created_at).getTime()
      const currTime = new Date(log.created_at).getTime()
      elapsedFromPrev = formatDuration(Math.max(0, currTime - prevTime))
    }
    return {
      ...log,
      elapsedFromPrev
    }
  })

  return (
    <div className="space-y-6 ">
      {/* 1. TOP SLA & CYCLE TIME SUMMARY BANNER */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-xl p-6 shadow-sm border border-blue-700/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-blue-100 border border-blue-400/30">
                Process Audit &amp; Stage Duration Analytics
              </span>
              <span className="text-xs text-blue-200">
                Ref: <strong className="font-mono text-white">{request.reference_no}</strong>
              </span>
            </div>

            <h2 className="text-lg font-bold text-white mt-1.5 flex items-center gap-2">
              <Hourglass className="w-5 h-5 text-blue-300" />
              {isClosed ? 'Relocation Completed & Register Closed' : currentStage ? `Currently Pending at ${currentStage.shortTitle}` : 'In Progress'}
            </h2>

            <p className="text-xs text-blue-100/80 mt-0.5">
              Exact chronological tracking of every approval, logistics handoff, and elapsed time at each stage.
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {/* Total Turnaround Time */}
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10 text-center">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Total Turnaround</span>
              <span className="text-base font-extrabold text-white mt-0.5 block">
                {totalDurationFormatted}
              </span>
              <span className="text-[9px] text-blue-300 block">
                {isClosed ? 'Submission to Closure' : 'Elapsed since creation'}
              </span>
            </div>

            {/* Current Stage Pending Duration */}
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10 text-center">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Current Stage Time</span>
              <span className="text-base font-extrabold text-emerald-300 mt-0.5 block">
                {isClosed ? 'Completed' : (currentStagePendingFormatted || '< 1 min')}
              </span>
              <span className="text-[9px] text-blue-300 block">
                {isClosed ? 'Register Closed' : 'Active at this stage'}
              </span>
            </div>

            {/* Stages Progress */}
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Stages Completed</span>
              <span className="text-base font-extrabold text-white mt-0.5 block">
                {completedCount} / {totalStages}
              </span>
              <span className="text-[9px] text-blue-300 block">Lifecycle steps</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-3">
          <div className="flex-1 bg-white/15 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${isRejected ? 'bg-rose-500' : isClosed ? 'bg-emerald-400' : 'bg-blue-400'}`}
              style={{ width: `${Math.round((completedCount / totalStages) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono font-semibold text-blue-200 shrink-0">
            {Math.round((completedCount / totalStages) * 100)}% Complete
          </span>
        </div>
      </div>

      {/* 2. HOW LONG IT PENDED AT EACH STAGE (STAGE BREAKDOWN GRID) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-50 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Stage Duration &amp; Pending Time Breakdown
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Measures how long this request spent awaiting action or being processed at each tier.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {slowestStage && (
              <div className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5 shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  Longest Stage: <strong>{slowestStage.shortTitle}</strong> ({slowestStage.durationFormatted})
                </span>
              </div>
            )}

            {(user?.role === 'admin' || user?.role === 'auditor') && (
              <button
                type="button"
                onClick={() => exportSingleRequestAuditToExcel(request, analytics, enrichedLogs, user)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition shrink-0"
                title="Audit & Compliance: Export this request's full audit trail and stage durations to Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>Export Audit to Excel (.xlsx)</span>
              </button>
            )}
          </div>
        </div>

        {/* Stages Timeline Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {stages.map((stage, idx) => {
            const isCompleted = stage.state === 'completed'
            const isPending = stage.state === 'currently_pending'
            const isStageRejected = stage.state === 'rejected'
            const isNotReached = stage.state === 'not_reached'

            return (
              <div
                key={stage.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  isPending
                    ? 'border-blue-400 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isStageRejected
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200 bg-slate-50/50 opacity-70'
                }`}
              >
                <div>
                  {/* Top: Stage # & Status Pill */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Stage {idx + 1}
                    </span>

                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Completed
                      </span>
                    )}

                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-slate-200 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        Pending Action
                      </span>
                    )}

                    {isStageRejected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        Rejected
                      </span>
                    )}

                    {isNotReached && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                        Upcoming
                      </span>
                    )}
                  </div>

                  {/* Stage Title */}
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {stage.title}
                  </h4>

                  {/* Responsible Actor */}
                  <p className="text-[11px] text-blue-700 font-medium mt-1 truncate">
                    {stage.actor}
                  </p>

                  {/* PENDING / ELAPSED DURATION HIGHLIGHT */}
                  <div className="mt-3 p-2.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {isPending ? 'Currently Pended' : isCompleted ? 'Time Spent in Stage' : 'Pending Duration'}
                      </span>
                      <span className="text-[9px] text-slate-400">Target: {stage.targetHours}h</span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span
                        className={`text-sm font-extrabold ${
                          isPending
                            ? 'text-blue-700'
                            : isCompleted
                            ? 'text-emerald-700'
                            : isStageRejected
                            ? 'text-rose-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {stage.durationFormatted}
                      </span>

                      {isCompleted && (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Within SLA
                        </span>
                      )}

                      {isPending && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded border border-slate-200">
                          Active Now
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Remarks / Notes if present */}
                  {stage.notes && (
                    <p className="mt-2 text-[10px] text-slate-600 bg-slate-50 border border-slate-100 rounded-md p-1.5 italic">
                      "{stage.notes}"
                    </p>
                  )}
                </div>

                {/* Timestamps Footer */}
                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>
                    Start: {stage.startTime ? new Date(stage.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <span>
                    Done: {stage.endTime ? new Date(stage.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (isPending ? 'Ongoing' : '—')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. COMPLETE CHRONOLOGICAL AUDIT EVENT LOG */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-50 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              {request?.fulfillment_type === 'it' || request?.transport_task?.fulfillment_type === 'it'
                ? 'IT Logistics Lifecycle Event History'
                : 'Transport Logistics Lifecycle Event History'} ({enrichedLogs.length})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {request?.fulfillment_type === 'it' || request?.transport_task?.fulfillment_type === 'it'
                ? 'Immutable institutional record of IT equipment de-racking, pickup, server mounting, and register closure.'
                : 'Immutable institutional record of transport logistics assignment, fleet dispatch, physical delivery, and register closure.'}
            </p>
          </div>

          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
            request?.fulfillment_type === 'it' || request?.transport_task?.fulfillment_type === 'it'
              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
              : 'bg-blue-50 text-blue-800 border-slate-200'
          }`}>
            {request?.fulfillment_type === 'it' || request?.transport_task?.fulfillment_type === 'it' ? (
              <>
                <Server className="w-3 h-3 text-indigo-600" />
                <span>IT Infrastructure Track</span>
              </>
            ) : (
              <>
                <Truck className="w-3 h-3 text-blue-600" />
                <span>Transport Logistics Track</span>
              </>
            )}
          </span>
        </div>

        {enrichedLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No audit records logged for this request yet.
          </div>
        ) : (
          <div className="space-y-3">
            {enrichedLogs.map((log, i) => {
              const isFirst = i === 0
              const actionLabel = log.action ? log.action.replace(/_/g, ' ') : 'EVENT LOGGED'
              const dateStr = log.created_at
                ? new Date(log.created_at).toLocaleDateString([], {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })
                : 'Date'
              const timeStr = log.created_at
                ? new Date(log.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })
                : 'Time'

              const isItEvent = (log.action || '').includes('IT_') || (log.performed_by_name || '').includes('IT ') || (log.performed_by_name || '').includes('Infrastructure')
              const isTransportEvent = (log.action || '').includes('TRANSPORT') || (log.performed_by_name || '').includes('Transport')

              return (
                <div
                  key={log.id || i}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-blue-50/20 transition flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Event Step Number */}
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                      {i + 1}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {actionLabel}
                        </span>

                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-slate-200">
                          {log.performed_by_name || 'System / Automated'}
                        </span>

                        {isItEvent && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1">
                            <Server className="w-2.5 h-2.5 text-indigo-600" />
                            IT Infrastructure
                          </span>
                        )}

                        {isTransportEvent && (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1">
                            <Truck className="w-2.5 h-2.5 text-blue-600" />
                            Transport Fleet
                          </span>
                        )}

                        {log.elapsedFromPrev && (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            +{log.elapsedFromPrev} after previous step
                          </span>
                        )}
                      </div>

                      {/* Remarks */}
                      {log.remarks && (
                        <p className="text-xs text-slate-700 mt-1">
                          {log.remarks}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-right shrink-0 text-slate-500 sm:self-center">
                    <p className="text-xs font-semibold text-slate-800">{dateStr}</p>
                    <p className="text-[10px] font-mono text-slate-400">{timeStr}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

