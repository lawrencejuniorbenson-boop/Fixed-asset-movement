// Date helpers. Supabase returns DATE columns as 'YYYY-MM-DD' and timestamps
// as ISO strings; both are shown in the viewer's locale.

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  // Treat plain dates as local calendar dates (avoid shifting a day by timezone).
  const plain = /^\d{4}-\d{2}-\d{2}$/.exec(value)
  if (plain) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value) {
  const d = toDate(value)
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export function formatDateTime(value) {
  const d = toDate(value)
  return d
    ? d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
}

export function timeAgo(value) {
  const d = toDate(value)
  if (!d) return ''
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.round(h / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(d)
}

// For <input type="date"> values.
export function todayISO() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
