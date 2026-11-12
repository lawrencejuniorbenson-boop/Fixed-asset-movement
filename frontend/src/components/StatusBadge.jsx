const STATUS_CONFIG = {
  pending_head: {
    label: 'Pending Unit Head',
    bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
    dot: 'bg-amber-500'
  },
  head_approved: {
    label: 'Asset Verification (AMA Pool)',
    bg: 'bg-sky-50 text-sky-700 border-sky-200/80',
    dot: 'bg-sky-500'
  },
  ama_officer_approved: {
    label: 'Final Authorization (AMA Pool)',
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    dot: 'bg-indigo-500'
  },
  fully_approved: {
    label: 'Awaiting Transport (Transport Pool)',
    bg: 'bg-purple-50 text-purple-700 border-purple-200/80',
    dot: 'bg-purple-500'
  },
  in_transport: {
    label: 'In Transit (Transport Pool)',
    bg: 'bg-blue-50 text-blue-700 border-blue-200/80',
    dot: 'bg-blue-500'
  },
  transport_completed: {
    label: 'Relocated • Awaiting Closure (AMA Pool)',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500'
  },
  closed: {
    label: 'Records Updated & Closed',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500'
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500'
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500'
  },
  // Transport Task specific statuses
  pending_assignment: {
    label: 'Transport Pool (Pending Assignment)',
    bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
    dot: 'bg-amber-500'
  },
  officer_assigned: {
    label: 'Scheduled • Transport Pool',
    bg: 'bg-sky-50 text-sky-700 border-sky-200/80',
    dot: 'bg-sky-500'
  },
  in_progress: {
    label: 'In Transit • Transport Pool',
    bg: 'bg-blue-50 text-blue-700 border-blue-200/80',
    dot: 'bg-blue-500'
  }
}

export default function StatusBadge({ status, fulfillmentType, className = '' }) {
  let config = STATUS_CONFIG[status] || {
    label: (status || 'Unknown').replace(/_/g, ' '),
    bg: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-400'
  }

  if (fulfillmentType === 'it') {
    if (status === 'pending_assignment') {
      config = { ...config, label: 'Pending IT Assignment (IT Pool)', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', dot: 'bg-indigo-500' }
    } else if (status === 'officer_assigned') {
      config = { ...config, label: 'Scheduled • IT Pool', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', dot: 'bg-indigo-500' }
    } else if (status === 'in_progress') {
      config = { ...config, label: 'IT Relocation in Progress • IT Pool', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', dot: 'bg-indigo-500' }
    } else if (status === 'fully_approved') {
      config = { ...config, label: 'Awaiting IT Relocation (IT Pool)', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', dot: 'bg-indigo-500' }
    } else if (status === 'in_transport') {
      config = { ...config, label: 'IT Relocation in Progress (IT Pool)', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', dot: 'bg-indigo-500' }
    } else if (status === 'transport_completed') {
      config = { ...config, label: 'IT Relocated • Awaiting Closure (AMA Pool)', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' }
    } else if (status === 'completed') {
      config = { ...config, label: 'IT Relocation Completed', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' }
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide border ${config.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  )
}

export { STATUS_CONFIG }
