import { useMemo, useSyncExternalStore } from 'react'

function subscribeResize(cb: () => void) {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

/** Viewport narrower than a tablet. Drives layout and the default discovery view. */
export function useIsSmall(): boolean {
  return useSyncExternalStore(
    subscribeResize,
    () => window.innerWidth < 768,
    () => false,
  )
}

export function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export type QualityTier = 'low' | 'high'

/** Coarse capability heuristic. Low tier: no shadows, fewer instances, lower DPR. */
export function detectTier(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const weakCpu = (nav.hardwareConcurrency ?? 8) <= 4
  const weakMem = (nav.deviceMemory ?? 8) <= 4
  return coarse || weakCpu || weakMem || window.innerWidth < 768 ? 'low' : 'high'
}

export function useQualityTier(): QualityTier {
  return useMemo(detectTier, [])
}

export function useWebGLSupport(): boolean {
  return useMemo(detectWebGL, [])
}
