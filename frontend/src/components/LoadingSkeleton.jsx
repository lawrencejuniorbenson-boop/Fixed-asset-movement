export default function LoadingSkeleton({ rows = 5 }) {
  return (
    <div className="animate-pulse divide-y divide-slate-100" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="space-y-2 px-5 py-4">
          <div className="h-3.5 w-1/3 rounded bg-slate-200" />
          <div className="h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="card animate-pulse space-y-4" role="status" aria-label="Loading">
      <div className="h-5 w-1/3 rounded bg-slate-200" />
      <div className="space-y-2">
        <div className="h-4 rounded bg-slate-100" />
        <div className="h-4 w-5/6 rounded bg-slate-100" />
        <div className="h-4 w-4/6 rounded bg-slate-100" />
      </div>
    </div>
  )
}
