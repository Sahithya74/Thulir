import { create } from 'zustand'
import { MAX_LINE_QTY, type CartIssue, type CartLineInput, type CartValidation } from '@thulir/shared'

const KEY = 'thulir.cart'

function load(): CartLineInput[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter((l): l is CartLineInput => !!l && typeof l.productId === 'string' && Number.isInteger(l.qty) && l.qty >= 1)
      .map((l) => ({ productId: l.productId, qty: Math.min(l.qty, MAX_LINE_QTY) }))
      .slice(0, 60)
  } catch {
    return []
  }
}

function save(lines: CartLineInput[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines))
  } catch {
    /* storage unavailable: the basket still works for this visit */
  }
}

export interface CartNotice {
  issue: CartIssue
  at: number
}

interface CartState {
  /** What the customer put in the basket: ids and quantities only. Prices always come from the server. */
  lines: CartLineInput[]
  open: boolean
  setOpen: (v: boolean) => void
  qtyOf: (productId: string) => number
  add: (productId: string, by?: number) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void

  /** The server's latest verdict on `lines`. Never persisted: it is recomputed, not remembered. */
  validation: CartValidation | null
  validationSource: 'api' | 'local' | null
  validating: boolean
  setValidating: (v: boolean) => void
  /** Apply a verdict: adopt the server's corrections (removed lines, reduced quantities) and tell the customer. */
  applyValidation: (v: CartValidation, source: 'api' | 'local') => void
  notices: CartNotice[]
  dismissNotices: () => void

  /** Screen-reader announcement for the last basket change. */
  announcement: string
  announce: (s: string) => void
}

export const useCart = create<CartState>((set, get) => ({
  lines: load(),
  open: false,
  setOpen: (open) => set({ open }),
  qtyOf: (id) => get().lines.find((l) => l.productId === id)?.qty ?? 0,

  add: (productId, by = 1) => {
    const lines = get().lines
    const cur = lines.find((l) => l.productId === productId)
    const next = Math.min(MAX_LINE_QTY, (cur?.qty ?? 0) + by)
    const updated = cur ? lines.map((l) => (l.productId === productId ? { ...l, qty: next } : l)) : [...lines, { productId, qty: next }]
    save(updated)
    set({ lines: updated })
  },

  setQty: (productId, qty) => {
    if (qty < 1) return get().remove(productId)
    const updated = get().lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, MAX_LINE_QTY) } : l))
    save(updated)
    set({ lines: updated })
  },

  remove: (productId) => {
    const updated = get().lines.filter((l) => l.productId !== productId)
    save(updated)
    set({ lines: updated })
  },

  clear: () => {
    save([])
    set({ lines: [], validation: null, notices: [] })
  },

  validation: null,
  validationSource: null,
  validating: false,
  setValidating: (validating) => set({ validating }),

  applyValidation: (v, source) => {
    const { lines, notices } = get()
    let next = lines
    const fresh: CartNotice[] = []
    for (const issue of v.issues) {
      if (issue.issue === 'QTY_REDUCED') next = next.map((l) => (l.productId === issue.productId ? { ...l, qty: issue.allowedQty } : l))
      else next = next.filter((l) => l.productId !== issue.productId)
      if (!notices.some((n) => n.issue.productId === issue.productId && n.issue.issue === issue.issue && n.issue.allowedQty === issue.allowedQty)) {
        fresh.push({ issue, at: Date.now() })
      }
    }
    if (next !== lines) save(next)
    set({ validation: v, validationSource: source, validating: false, lines: next, notices: fresh.length ? [...notices, ...fresh] : notices })
  },

  notices: [],
  dismissNotices: () => set({ notices: [] }),

  announcement: '',
  announce: (announcement) => set({ announcement }),
}))

export const cartCount = (lines: CartLineInput[]) => lines.reduce((n, l) => n + l.qty, 0)
