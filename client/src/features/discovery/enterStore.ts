import type { NavigateFunction } from 'react-router-dom'
import type { StoreWithDelivery } from '@thulir/shared'
import { prefersReducedMotion } from '@/hooks/useReducedMotion'
import { pick, type Lang } from '@/services/i18n'
import { cameraBus } from '@/scenes/neighbourhood/cameraBus'
import { useTransition } from '@/store/transition'

/**
 * Start the store-entry sequence. Refuses stores that do not deliver to the customer's location:
 * the UI disables the button too, but the rule is enforced here as well.
 */
export function enterStore(store: StoreWithDelivery, lang: Lang, nav: NavigateFunction, from3D: boolean): boolean {
  if (!store.delivery.deliverable) return false
  const target = { slug: store.slug, name: pick(store.name, lang), category: store.category }

  if (prefersReducedMotion()) {
    nav(`/store/${store.slug}`)
    return true
  }
  if (from3D) cameraBus.emit('enter', store.id)
  // Let the camera reach the door (≈0.9s) before the wipe starts; without 3D go straight to the wipe.
  window.setTimeout(() => useTransition.getState().begin(target), from3D ? 750 : 0)
  return true
}
