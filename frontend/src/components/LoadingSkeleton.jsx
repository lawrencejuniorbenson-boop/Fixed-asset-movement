export default function LoadingSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2.5 border-b border-blue-50">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1 h-3.5 bg-blue-100/60 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse card space-y-4">
      <div className="h-5 bg-blue-100/60 rounded-md w-1/3" />
      <div className="space-y-2">
        <div className="h-4 bg-blue-100/60 rounded-md" />
        <div className="h-4 bg-blue-100/60 rounded-md w-5/6" />
        <div className="h-4 bg-blue-100/60 rounded-md w-4/6" />
      </div>
    </div>
  )
}
