import gsap from 'gsap'
import { dur, ease } from '@/services/motion'

/** Small, quick "the basket received something" acknowledgement. */
function bump(target: Element) {
  if (dur(1) === 0) return
  gsap.fromTo(target, { scale: 1 }, { scale: 1.16, duration: 0.14, yoyo: true, repeat: 1, ease: ease.studio })
}

/**
 * Animate a copy of the product's artwork from where it was added to the basket icon. Purely decorative: the basket
 * state has already changed by the time this runs, and under reduced motion only the (instant) acknowledgement is skipped.
 */
export function flyToBasket(from: Element | null) {
  const target = document.querySelector('[data-basket-target]')
  if (!target) return
  const art = from?.closest('[data-product-card], [data-product-panel]')?.querySelector('img, svg')
  if (!art || dur(1) === 0) return bump(target)

  const a = art.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  if (a.width === 0 || b.width === 0) return bump(target)

  const clone = art.cloneNode(true) as HTMLElement
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    pointerEvents: 'none',
    zIndex: '200',
    transformOrigin: 'center',
  })
  clone.setAttribute('aria-hidden', 'true')
  document.body.appendChild(clone)

  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  gsap.to(clone, {
    x: dx,
    y: dy,
    scale: 0.22,
    opacity: 0.35,
    duration: 0.62,
    ease: 'power2.in',
    onComplete: () => {
      clone.remove()
      bump(target)
    },
  })
}
