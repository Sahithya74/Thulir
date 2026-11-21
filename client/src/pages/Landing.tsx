import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { LanguageSwitch } from '@/components/navigation/TopBar'
import { useT } from '@/services/i18n'
import { dur, ease } from '@/services/motion'
import { useUiStore } from '@/store/ui'
import { useWebGLSupport } from '@/hooks/useDevice'

/** Architectural line-drawing of a town-centre skyline; strokes are "drawn in" by GSAP. */
function Skyline() {
  return (
    <svg viewBox="0 0 800 200" className="w-full max-w-[760px]" fill="none" stroke="#7fd3c1" strokeWidth="1.2" aria-hidden>
      <path className="draw" pathLength="1" strokeDasharray="1" d="M0 190H800" />
      <path className="draw" pathLength="1" strokeDasharray="1" d="M30 190V120H100V190M30 120L65 100L100 120M45 150H85M45 170H85" />
      <path className="draw" pathLength="1" strokeDasharray="1" d="M130 190V70H230V190M130 70H230M150 95H210M150 120H210M150 145H210M150 170H210M180 70V50H196V70" />
      <path className="draw" pathLength="1" strokeDasharray="1" d="M260 190V140H340V190M260 140H340M280 140V120H350V140M275 165H325" />
      <path className="draw" pathLength="1" strokeDasharray="1" d="M370 190V40H470V190M370 40H470M390 70H450M390 100H450M390 130H450M390 160H450M420 40V20" />
      <path className="draw" pathLength="1" strokeDasharray="1" d="M500 190V130H610V190M495 130H615M520 150H590M520 170H590" stroke="#ee5a36" />
      <path className="draw" pathLength="1" strokeDasharray="1" d="M640 190V95H720V190M640 95H720M655 120H705M655 145H705M655 170H705" />
      <path className="draw" pathLength="1" strokeDasharray="1" d="M745 190V150H790V190" />
    </svg>
  )
}

export default function Landing() {
  const t = useT()
  const nav = useNavigate()
  const setEntered = useUiStore((s) => s.setEntered)
  const webgl = useWebGLSupport()
  const root = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [pct, setPct] = useState(0)

  // Real loading steps: fonts decoded, and (when WebGL exists) the 3D chunk fetched.
  useEffect(() => {
    let alive = true
    const steps = webgl ? 2 : 1
    let done = 0
    const bump = () => {
      done++
      if (alive) setPct(Math.round((done / steps) * 100))
    }
    const fonts = (document.fonts?.ready ?? Promise.resolve()).then(bump)
    const scene = webgl ? import('@/scenes/neighbourhood/NeighbourhoodCanvas').then(bump, bump) : Promise.resolve()
    // Minimum beat so the intro reads as designed rather than flashing past.
    const minimum = new Promise((r) => setTimeout(r, dur(1600) === 0 ? 0 : 1600))
    Promise.all([fonts, scene, minimum]).then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [webgl])

  // Entrance timeline.
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: ease.enter } })
      tl.from('.draw', { strokeDashoffset: 1, duration: dur(1.8), stagger: 0.12 }, 0)
      tl.from('.reveal', { y: dur(26), opacity: 0, duration: dur(1.1), stagger: 0.14 }, 0.3)
    }, root)
    return () => ctx.revert()
  }, [])

  // Progress line follows the real percentage.
  useEffect(() => {
    if (barRef.current) gsap.to(barRef.current, { scaleX: pct / 100, duration: dur(0.5), ease: ease.studio })
  }, [pct])

  const enter = () => {
    setEntered(true)
    const go = () => nav('/discover')
    if (dur(1) === 0) return go()
    gsap.to(root.current, { opacity: 0, duration: 0.45, ease: 'power2.in', onComplete: go })
  }

  return (
    <div ref={root} className="relative flex min-h-dvh flex-col bg-forest text-cream">
      <div className="flex items-center justify-between px-5 py-4 sm:px-8">
        <span className="eyebrow !text-botanical reveal">{t('demoPrototype')}</span>
        <div className="reveal [&_button]:text-cream [&>div]:border-cream/30 [&_button[aria-pressed=true]]:bg-cream [&_button[aria-pressed=true]]:text-forest">
          <LanguageSwitch />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 pb-10 sm:px-8">
        <div className="reveal mb-8 sm:mb-12">
          <Skyline />
        </div>
        <h1 className="reveal font-display text-[clamp(3.2rem,11vw,8rem)] leading-[0.92] tracking-[0.06em] [html[lang=ta]_&]:tracking-normal">{t('brand').toUpperCase()}</h1>
        <p className="reveal mt-5 max-w-xl font-display text-[clamp(1.2rem,2.6vw,1.75rem)] leading-snug text-limestone">{t('tagline')}</p>
        <p className="reveal mt-2 text-[0.9rem] text-botanical">{t('taglineAlt')}</p>

        <div className="reveal mt-10 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={enter}
            disabled={!ready}
            className="tap border border-cream bg-cream px-7 text-[0.95rem] font-medium text-forest transition-colors hover:bg-limestone disabled:cursor-wait disabled:border-cream/30 disabled:bg-transparent disabled:text-cream/50"
          >
            {ready ? t('enter') : `${t('loading')}…`}
          </button>
          {!ready && (
            <button type="button" onClick={enter} className="tap px-2 text-[0.8rem] text-botanical underline underline-offset-4">
              {t('skip')}
            </button>
          )}
        </div>

        <p className="reveal mt-6 text-[0.85rem] text-botanical">
          Run a store? <Link to="/owner/login" className="underline underline-offset-4 hover:text-cream">Sign in to your store</Link>
          <span aria-hidden> · </span>
          <Link to="/delivery/login" className="underline underline-offset-4 hover:text-cream">Delivery partners</Link>
          <span aria-hidden> · </span>
          <Link to="/admin/login" className="underline underline-offset-4 hover:text-cream">Platform admin</Link>
        </p>

        <div className="reveal mt-8 h-px w-full max-w-xs bg-cream/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('loading')}>
          <div ref={barRef} className="h-full origin-left bg-terracotta" style={{ transform: 'scaleX(0)' }} />
        </div>
      </main>
    </div>
  )
}
