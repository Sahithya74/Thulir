export interface GeoPoint {
  lat: number
  lng: number
}

const R = 6_371_000 // mean Earth radius, metres

/** Great-circle distance in metres. */
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Point `eastM` / `northM` metres from `origin` (small-distance approximation, fine below ~50 km). */
export function offsetPoint(origin: GeoPoint, eastM: number, northM: number): GeoPoint {
  const dLat = northM / 111_320
  const dLng = eastM / (111_320 * Math.cos((origin.lat * Math.PI) / 180))
  return { lat: origin.lat + dLat, lng: origin.lng + dLng }
}

/** Metres east / north of `origin` — the inverse of offsetPoint, used by the schematic map. */
export function metresFrom(origin: GeoPoint, p: GeoPoint): { east: number; north: number } {
  return {
    east: (p.lng - origin.lng) * 111_320 * Math.cos((origin.lat * Math.PI) / 180),
    north: (p.lat - origin.lat) * 111_320,
  }
}
