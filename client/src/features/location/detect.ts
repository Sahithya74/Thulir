import type { GeoPoint } from '@thulir/shared'

export type DetectError = 'denied' | 'unavailable'

export class DetectFailure extends Error {
  readonly kind: DetectError
  constructor(kind: DetectError) {
    super(kind)
    this.kind = kind
  }
}

/** Promise wrapper around the Geolocation API with explicit, user-readable failure kinds. */
export function detectPosition(timeoutMs = 10_000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new DetectFailure('unavailable'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new DetectFailure(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}
