import { prefersReducedMotion } from '@/hooks/useReducedMotion'

/** Central motion language. Durations collapse to 0 under prefers-reduced-motion. */
export const ease = {
  studio: 'power2.out',
  inOut: 'power3.inOut',
  enter: 'expo.out',
} as const

export function dur(seconds: number): number {
  return prefersReducedMotion() ? 0 : seconds
}
