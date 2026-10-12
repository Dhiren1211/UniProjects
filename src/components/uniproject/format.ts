// ============================================================
// UniProject — shared formatting helpers (client-safe, deterministic)
// ============================================================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "Mar 12, 2026" */
export function formatDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/** "Mar 12, 2026, 3:05 PM" */
export function formatDateTime(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(d.getTime())) return ''
  let h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(d)}, ${h}:${m} ${ampm}`
}

/** Relative time: "just now" → "5m ago" → "2h ago" → "3d ago" → "Mar 12" */
export function timeAgo(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  const then = d.getTime()
  if (isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** First letters of the first 2 words, uppercase, max 2. "Kim Minseo" → "KM" */
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

/** "3 projects" / "1 project" */
export function pluralize(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`
}
