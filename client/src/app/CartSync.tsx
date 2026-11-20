import { useEffect } from 'react'
import { demoTowns } from '@thulir/shared'
import { ordersApi } from '@/services/ordersApi'
import { useCart } from '@/store/cart'
import { useLocation } from '@/store/location'

/**
 * Keeps the basket honest: whenever the basket or the delivery location changes, ask the server to re-price and
 * re-validate it, then adopt its corrections. The customer sees what changed (see CartNotices) — nothing is silent.
 */
export function CartSync() {
  const lines = useCart((s) => s.lines)
  const geo = useLocation((s) => s.location?.geo)
  const lat = geo?.lat
  const lng = geo?.lng

  useEffect(() => {
    const { applyValidation, setValidating } = useCart.getState()
    if (lines.length === 0) {
      useCart.setState({ validation: null, validating: false })
      return
    }
    const ctrl = new AbortController()
    setValidating(true)
    // Debounced: quantity steppers can fire quickly, and each change is re-priced.
    const id = window.setTimeout(() => {
      const where = lat !== undefined && lng !== undefined ? { lat, lng } : demoTowns[0].center
      ordersApi
        .validateCart(lines, where, ctrl.signal)
        .then((r) => !ctrl.signal.aborted && applyValidation(r.data, r.source))
        .catch((e: unknown) => {
          if ((e as Error).name !== 'AbortError') setValidating(false)
        })
    }, 200)
    return () => {
      window.clearTimeout(id)
      ctrl.abort()
    }
  }, [lines, lat, lng])

  return null
}
