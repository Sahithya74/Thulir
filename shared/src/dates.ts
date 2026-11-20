/** Date helpers pinned to Asia/Kolkata. All business-day logic (expiry, opening hours) uses these. */

const IST_OFFSET_MIN = 330 // UTC+05:30, no DST

/** Returns the IST calendar date (YYYY-MM-DD) for the given instant. */
export function istDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + IST_OFFSET_MIN * 60_000)
  return shifted.toISOString().slice(0, 10)
}

/** Minutes since IST midnight. */
export function istMinutes(now: Date = new Date()): number {
  const shifted = new Date(now.getTime() + IST_OFFSET_MIN * 60_000)
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** True when the IST minute-of-day falls inside [opens, closes). Supports ranges that cross midnight. */
export function isOpenAtMinute(hours: { opens: string; closes: string }, minuteOfDay: number): boolean {
  const open = toMinutes(hours.opens)
  const close = toMinutes(hours.closes)
  return open <= close ? minuteOfDay >= open && minuteOfDay < close : minuteOfDay >= open || minuteOfDay < close
}

/** True when `now` falls inside [opens, closes) in IST. Supports ranges that cross midnight. */
export function isOpenAt(hours: { opens: string; closes: string }, now: Date = new Date()): boolean {
  return isOpenAtMinute(hours, istMinutes(now))
}

/** True only for a real calendar date written as YYYY-MM-DD (rejects "2026-02-30", "soon", "", etc.). */
export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Whole days from `a` to `b` (both YYYY-MM-DD). Positive when b is later. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}
