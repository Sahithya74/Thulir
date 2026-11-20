const KEY = 'thulir.recentSearches'
const MAX = 6

export function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable — recents simply do not persist */
  }
}

/** Most recent first, de-duplicated case-insensitively, capped. Searches stay in this browser only. */
export function addRecent(query: string): string[] {
  const q = query.trim()
  if (q.length < 2) return readRecent()
  const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX)
  write(next)
  return next
}

export function clearRecent(): string[] {
  write([])
  return []
}
