import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { categoryKey, useT } from '@/services/i18n'
import { dur, ease } from '@/services/motion'
import { useTransition } from '@/store/transition'

/**
 * Full-screen wipe that bridges the 3D district and a store page.
 * covering → (navigate) → covered → revealing → idle. The destination page flips `covered` to `revealing`.
 */
export function StoreTransition() {
  const t = useT()
  const nav = useNavigate()
  const phase = useTransition((s) => s.phase)
  const target = useTransition((s) => s.target)
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = el.current
    if (!node) return
    const { setPhase, finish } = useTransition.getState()
    let tween: gsap.core.Tween | undefined
    let safety: number | undefined

    if (phase === 'covering') {
      tween = gsap.fromTo(
        node,
        { clipPath: 'inset(100% 0% 0% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: dur(0.55),
          ease: ease.inOut,
          onComplete: () => {
            const slug = useTransition.getState().target?.slug
            if (slug) nav(`/store/${slug}`)
            setPhase('covered')
          },
        },
      )
    } else if (phase === 'covered') {
      // If the destination never reveals (error, unmounted), do not trap the user behind the wipe.
      safety = window.setTimeout(() => setPhase('revealing'), 3000)
    } else if (phase === 'revealing') {
      tween = gsap.to(node, {
        clipPath: 'inset(0% 0% 100% 0%)',
        duration: dur(0.6),
        ease: ease.inOut,
        onComplete: finish,
      })
    }
    return () => {
      tween?.kill()
      window.clearTimeout(safety)
    }
  }, [phase, nav])

  if (phase === 'idle' || !target) return null
  return (
    <div
      ref={el}
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-start justify-end bg-forest px-6 pb-16 text-cream sm:px-14"
      style={{ clipPath: 'inset(100% 0% 0% 0%)' }}
    >
      <span className="eyebrow !text-botanical">{t(categoryKey[target.category])}</span>
      <span className="mt-2 font-display text-[clamp(2rem,6vw,4.5rem)] leading-[1.02]">{target.name}</span>
      <span className="mt-4 h-px w-24 bg-terracotta" />
    </div>
  )
}
