import { haversineM, type GeoPoint } from './geo.ts'
import type { Area, SavedAddress, Town, UserLocation } from './types.ts'

/** A detected position further than this from every sample town is treated as "outside the demo area". */
export const DETECT_RADIUS_M = 25_000

export function findTown(towns: Town[], townId: string): Town | undefined {
  return towns.find((t) => t.id === townId)
}

export function findArea(towns: Town[], areaId: string): Area | undefined {
  for (const t of towns) {
    const a = t.areas.find((x) => x.id === areaId)
    if (a) return a
  }
  return undefined
}

export function locationFromArea(area: Area): UserLocation {
  return { source: 'area', townId: area.townId, areaId: area.id, label: area.name, geo: area.geo }
}

export function locationFromAddress(addr: SavedAddress, towns: Town[]): UserLocation | null {
  const area = findArea(towns, addr.areaId)
  if (!area) return null
  const text = `${addr.line1}, ${area.name.en}`
  const textTa = `${addr.line1}, ${area.name.ta}`
  // Prototype: an address is placed at its area's centre. Real geocoding arrives with a maps provider.
  return { source: 'address', townId: addr.townId, areaId: area.id, label: { en: text, ta: textTa }, geo: area.geo, addressId: addr.id }
}

export type DetectResult =
  | { ok: true; location: UserLocation; nearestAreaDistanceM: number }
  | { ok: false; reason: 'outside_service_area'; nearestTownId: string; distanceM: number }

/** Map a raw GPS fix onto a sample town, or say honestly that it is outside the demo area. */
export function resolveDetectedPosition(towns: Town[], p: GeoPoint): DetectResult {
  let best: { town: Town; d: number } | null = null
  for (const t of towns) {
    const d = haversineM(t.center, p)
    if (!best || d < best.d) best = { town: t, d }
  }
  if (!best) throw new Error('No towns configured')
  if (best.d > DETECT_RADIUS_M) {
    return { ok: false, reason: 'outside_service_area', nearestTownId: best.town.id, distanceM: Math.round(best.d) }
  }
  let nearest = best.town.areas[0]
  let nd = Infinity
  for (const a of best.town.areas) {
    const d = haversineM(a.geo, p)
    if (d < nd) {
      nd = d
      nearest = a
    }
  }
  return {
    ok: true,
    nearestAreaDistanceM: Math.round(nd),
    location: {
      source: 'detected',
      townId: best.town.id,
      areaId: nearest.id,
      label: { en: `Near ${nearest.name.en}`, ta: `${nearest.name.ta} அருகில்` },
      geo: p,
    },
  }
}

export type PincodeCheck = 'ok' | 'invalid_format' | 'not_serviceable'

export function checkPincode(town: Town, pincode: string): PincodeCheck {
  if (!/^[1-8]\d{5}$/.test(pincode)) return 'invalid_format'
  return town.pincodes.includes(pincode) ? 'ok' : 'not_serviceable'
}
