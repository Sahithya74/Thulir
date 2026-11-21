import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '@/hooks/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

/** Central motion language. Durations collapse to 0 under prefers-reduced-motion. */
export const ease = {
  studio: 'power2.out',
  inOut: 'power3.inOut',
  enter: 'expo.out',
  spring: 'back.out(1.6)',
} as const

export function dur(seconds: number): number {
  return prefersReducedMotion() ? 0 : seconds
}

/**
 * Scroll-linked entrance for every `[data-reveal]` inside `scope`. Elements rise, fade and (optionally) tilt in as
 * they enter the viewport; `data-reveal="left|right|scale"` picks the direction. Call inside a gsap.context.
 */
export function revealOnScroll(scope: Element | null): void {
  if (!scope || prefersReducedMotion()) return
  const items = gsap.utils.toArray<HTMLElement>('[data-reveal]', scope)
  items.forEach((el) => {
    if (el.dataset.revealed) return
    el.dataset.revealed = '1'
    const kind = el.dataset.reveal
    const from: gsap.TweenVars = { opacity: 0, duration: 1, ease: ease.enter }
    if (kind === 'left') from.x = -60
    else if (kind === 'right') from.x = 60
    else if (kind === 'scale') from.scale = 0.88
    else from.y = 48
    gsap.from(el, { ...from, scrollTrigger: { trigger: el, start: 'top 88%', once: true }, delay: Number(el.dataset.delay ?? 0) })
  })
}

/** Parallax drift for every `[data-speed]` element inside `scope` (positive = slower than scroll). */
export function parallax(scope: Element | null): void {
  if (!scope || prefersReducedMotion()) return
  gsap.utils.toArray<HTMLElement>('[data-speed]', scope).forEach((el) => {
    const speed = Number(el.dataset.speed ?? 0.2)
    gsap.to(el, { yPercent: -speed * 100, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } })
  })
}

export { gsap, ScrollTrigger }
