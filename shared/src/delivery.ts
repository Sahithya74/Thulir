import { haversineM, type GeoPoint } from './geo.ts'
import type { Store, StoreWithDelivery } from './types.ts'

export const MINUTES_PER_KM = 4 // scooter in town traffic, including hand-over
const ROUND_TO_MIN = 5

/**
 * Simulated delivery rules for the prototype. Real rules (zones, partner availability, traffic)
 * arrive with the delivery phase. The shape of the result is what the rest of the app depends on.
 */
export function deliveryFor(store: Store, to: GeoPoint) {
  const distanceM = Math.round(haversineM(store.geo, to))
  const deliverable = distanceM <= store.deliveryRadiusM
  const raw = store.prepMin + (distanceM / 1000) * MINUTES_PER_KM
  const etaMin = Math.ceil(raw / ROUND_TO_MIN) * ROUND_TO_MIN
  return { distanceM, etaMin, deliverable }
}

export function withDelivery(store: Store, to: GeoPoint): StoreWithDelivery {
  return { ...store, delivery: deliveryFor(store, to) }
}

export function withDeliveryAll(stores: Store[], to: GeoPoint): StoreWithDelivery[] {
  return stores.map((s) => withDelivery(s, to))
}
