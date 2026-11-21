import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LanguageSwitch } from '@/components/navigation/TopBar'
import { ProductArt } from '@/components/products/ProductArt'
import { Tilt } from '@/components/ui/Tilt'
import { SHOWCASE, TONES } from '@/features/discovery/showcase'
import type { PackSource } from '@/components/products/packDesign'
import { categoryKey, useT } from '@/services/i18n'
import { dur, ease, gsap, parallax, revealOnScroll, ScrollTrigger } from '@/services/motion'
import { useUiStore } from '@/store/ui'
import { useWebGLSupport } from '@/hooks/useDevice'

const L = (en: string, ta: string) => ({ en, ta })

/** Illustrative packs for the hero. These are drawn by the same painter the shops use, not photographs. */
const HERO_PACKS: { p: PackSource; size: number; cls: string; depth: number; rot: number }[] = [
  { p: { id: 'h-salt', name: L('Crystal Salt', 'உப்பு'), brand: 'Thulir Pantry', unit: '1 kg', department: 'pantry', shape: 'pouch', color: '#e8eef5', veg: true }, size: 190, cls: 'left-[0%] top-[34%]', depth: 30, rot: -9 },
  { p: { id: 'h-rice', name: L('Ponni Rice', 'பொன்னி அரிசி'), brand: 'Kaveri', unit: '5 kg', department: 'pantry', shape: 'pouch', color: '#f3d9a0', veg: true }, size: 290, cls: 'left-[20%] top-[0%]', depth: 55, rot: 5 },
  { p: { id: 'h-tea', name: L('Assam Tea', 'தேநீர்'), brand: 'Chai Co', unit: '250 g', department: 'beverages', shape: 'box', color: '#b7332b', veg: true }, size: 230, cls: 'right-[6%] top-[4%]', depth: 40, rot: -4 },
  { p: { id: 'h-milk', name: L('Fresh Milk', 'பால்'), brand: 'Pasumai', unit: '1 L', department: 'chilled', shape: 'carton', color: '#3b8fd6', veg: true }, size: 240, cls: 'right-[0%] top-[40%]', depth: 65, rot: 8 },
  { p: { id: 'h-oil', name: L('Groundnut Oil', 'கடலை எண்ணெய்'), brand: 'Selvam', unit: '1 L', department: 'pantry', shape: 'bottle', color: '#e6a817', veg: true }, size: 210, cls: 'left-[6%] bottom-[0%]', depth: 25, rot: 6 },
  { p: { id: 'h-bisc', name: L('Butter Biscuits', 'பிஸ்கட்'), brand: 'Madhuram', unit: '200 g', department: 'snacks', shape: 'box', color: '#d9742a', veg: true }, size: 200, cls: 'left-[42%] bottom-[2%]', depth: 50, rot: -7 },
]

const CATS = ['supermarket', 'provision', 'fruit_veg', 'bakery', 'dairy', 'household'] as const
const STEP_COLORS = ['bg-sun text-forest', 'bg-terracotta text-cream', 'bg-botanical text-forest', 'bg-forest text-cream']

/** True once the element has come near the viewport: used to paint heavy artwork only when it is about to be seen. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen] as const
}

function ShelfCard({ c, i }: { c: (typeof CATS)[number]; i: number }) {
  const t = useT()
  const [ref, seen] = useSeen<HTMLDivElement>()
  const [ready, setReady] = useState(false)
  // Painting a pack is real canvas work: spread the cards out so scrolling stays smooth.
  useEffect(() => {
    if (!seen) return
    const id = window.setTimeout(() => setReady(true), (i % 3) * 450)
    return () => window.clearTimeout(id)
  }, [seen, i])
  const [from, to] = TONES[c]
  return (
    <div ref={ref} data-reveal={i % 2 ? 'right' : 'left'} className={i % 3 === 1 ? 'lg:translate-y-10' : ''}>
      <Tilt className="relative h-72 rounded-[2rem] text-cream shadow-[0_30px_50px_-28px_rgba(43,26,18,0.6)]" style={{ background: `linear-gradient(155deg, ${from}, ${to})` }} max={8}>
        <span aria-hidden className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative p-6 [transform:translateZ(30px)]">
          <p className="eyebrow !text-cream/70">0{i + 1}</p>
          <h3 className="mt-1 font-display text-[1.9rem] leading-tight">{t(categoryKey[c])}</h3>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-40 items-end justify-center gap-1 [transform-style:preserve-3d]">
          {ready &&
            SHOWCASE[c].map((p, k) => (
              <div key={p.id} className="[transform-style:preserve-3d]" style={{ transform: `translate3d(calc(var(--px, 0) * ${(k + 1) * 10}px), calc(var(--py, 0) * ${(k + 1) * 5}px), ${40 + k * 26}px) rotate(${(k - 1) * 7}deg)` }}>
                <div style={{ width: k === 1 ? 150 : 120 }} className="[&>img]:h-auto [&>img]:w-full">
                  <ProductArt product={p} size={160} />
                </div>
              </div>
            ))}
        </div>
      </Tilt>
    </div>
  )
}

function Marquee({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const row = [...items, ...items]
  return (
    <div className="overflow-hidden" aria-hidden>
      <div className={`flex w-max gap-10 ${reverse ? 'marquee-rev' : 'marquee'}`}>
        {row.map((x, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-[clamp(2rem,6vw,4.5rem)] leading-none">
            {x}
            <span className="inline-block h-3 w-3 rotate-45 bg-terracotta" />
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  const t = useT()
  const nav = useNavigate()
  const setEntered = useUiStore((s) => s.setEntered)
  const webgl = useWebGLSupport()
  const root = useRef<HTMLDivElement>(null)
  const hero = useRef<HTMLElement>(null)
  
  // Warm the fonts (and the 3D district, when available) while people read; never block them.
  useEffect(() => {
    const fonts = (document.fonts?.ready ?? Promise.resolve()) as Promise<unknown>
    const scene = webgl ? import('@/scenes/neighbourhood/NeighbourhoodCanvas').catch(() => undefined) : Promise.resolve()
    void Promise.all([fonts, scene])
  }, [webgl])

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: ease.enter } })
      tl.from('.hero-word', { yPercent: dur(110), duration: dur(1.2), stagger: 0.09 }, 0.1)
      tl.from('.hero-fade', { y: dur(24), opacity: 0, duration: dur(1), stagger: 0.12 }, 0.5)
      tl.from('.hero-pack', { y: dur(120), scale: 0.6, opacity: 0, duration: dur(1.4), stagger: 0.1, ease: ease.spring }, 0.3)
      // Packs float gently forever, each on its own rhythm.
      gsap.utils.toArray<HTMLElement>('.hero-float').forEach((el, i) => {
        gsap.to(el, { y: dur(-16 - (i % 3) * 6), duration: 2.6 + i * 0.35, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      })
      gsap.to('.blob', { x: dur(40), y: dur(-30), scale: 1.12, duration: 7, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 1.4 })
      revealOnScroll(root.current)
      parallax(root.current)
      gsap.to('.scroll-bar', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: 0.3 } })
      void ScrollTrigger
    }, root)
    return () => ctx.revert()
  }, [])

  // Pointer parallax: each pack shifts by its own depth.
  const onMove = (e: React.PointerEvent) => {
    const el = hero.current
    if (!el || dur(1) === 0) return
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    gsap.utils.toArray<HTMLElement>('.hero-pack').forEach((p) => {
      const d = Number(p.dataset.depth ?? 30)
      gsap.to(p, { x: nx * d * -1.4, y: ny * d * -1.4, duration: 0.9, ease: ease.studio, overwrite: 'auto' })
    })
  }

  const enter = () => {
    setEntered(true)
    const go = () => nav('/discover')
    if (dur(1) === 0) return go()
    gsap.to(root.current, { opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: go })
  }

  const steps = [
    { t: t('step1T'), b: t('step1B'), span: 'md:col-span-3 md:row-span-2', n: '01' },
    { t: t('step2T'), b: t('step2B'), span: 'md:col-span-3', n: '02' },
    { t: t('step3T'), b: t('step3B'), span: 'md:col-span-3', n: '03' },
    { t: t('step4T'), b: t('step4B'), span: 'md:col-span-6', n: '04' },
  ]
  const cats = CATS.map((c) => t(categoryKey[c]))

  return (
    <div ref={root} className="relative overflow-x-clip text-forest">
      <div aria-hidden className="scroll-bar fixed inset-x-0 top-0 z-50 h-1 origin-left scale-x-0 bg-terracotta" />
      {/* Hero */}
      <header ref={hero} onPointerMove={onMove} className="relative min-h-dvh overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="blob absolute -left-24 top-10 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(245,184,46,0.55),transparent)]" />
          <div className="blob absolute right-[-8rem] top-1/3 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(217,79,43,0.3),transparent)]" />
          <div className="blob absolute bottom-[-10rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,rgba(169,207,138,0.6),transparent)]" />
        </div>

        <div className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-10">
          <span className="font-display text-2xl tracking-wide">{t('brand')}</span>
          <div className="flex items-center gap-4">
            <span className="eyebrow hidden sm:inline">{t('demoPrototype')}</span>
            <LanguageSwitch />
          </div>
        </div>

        <div aria-hidden className="absolute bottom-10 left-[44%] z-20 hidden h-32 w-32 lg:block wobble">
          <svg viewBox="0 0 120 120" className="spin-slow absolute inset-0 text-forest">
            <defs>
              <path id="circ" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
            </defs>
            <text fontSize="9.5" fontWeight="600" fill="currentColor">
              <textPath href="#circ" textLength="270" lengthAdjust="spacing">{t('badgeText')}</textPath>
            </text>
          </svg>
          <div className="absolute inset-[22%] grid place-items-center rounded-full bg-sun font-display text-xl text-forest shadow-lg">துளிர்</div>
        </div>
        <div className="pointer-events-none absolute right-[3%] top-[14%] hidden h-[72%] w-[46%] lg:block" aria-hidden>
          {HERO_PACKS.map(({ p, size, cls, depth, rot }) => (
            <div key={p.id} className={`hero-pack absolute ${cls}`} data-depth={depth}>
              <div className="hero-float" style={{ rotate: `${rot}deg` }}>
                <ProductArt product={p} size={size} />
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 mx-auto flex min-h-[78dvh] max-w-6xl flex-col justify-end px-5 pb-16 pt-24 sm:px-10 lg:justify-center lg:pt-0">
          <p className="hero-fade eyebrow mb-5 !text-terracotta">{t('heroKicker')}</p>
          <h1 className="font-display text-[clamp(3rem,7.2vw,6.6rem)] leading-[0.98] tracking-tight">
            <span className="block overflow-hidden">
              <span className="hero-word block">{t('heroLine1')}</span>
            </span>
            <span className="block overflow-hidden">
              <span className="hero-word relative block italic text-terracotta">
                {t('heroLine2')}
                <svg aria-hidden viewBox="0 0 400 16" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-3 w-full text-sun">
                  <path d="M2 10 C 60 2, 110 14, 170 7 S 290 3, 398 9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
            </span>
          </h1>
          <p className="hero-fade mt-6 max-w-xl text-[1.05rem] leading-relaxed text-charcoal/80">{t('heroBody')}</p>
          <div className="hero-fade mt-9 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={enter}
              className="tap group relative overflow-hidden rounded-full bg-forest px-8 py-3 text-[1rem] font-medium text-cream shadow-[0_18px_40px_-12px_rgba(43,26,18,0.55)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="relative z-10">{t('chooseShop')}</span>
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-terracotta transition-transform duration-500 ease-out group-hover:translate-x-0" />
            </button>
            <a href="#how" className="tap flex items-center px-3 text-[0.95rem] underline decoration-terracotta/60 underline-offset-4 hover:decoration-terracotta">
              {t('seeHow')}
            </a>
          </div>
        </div>
      </header>

      {/* Marquee */}
      <section aria-hidden className="border-y border-forest/10 bg-sun py-6">
        <div className="flex flex-col gap-4">
          <Marquee items={cats} />
          <div className="text-forest/70">
            <Marquee items={cats.slice().reverse()} reverse />
          </div>
        </div>
      </section>

      {/* On the shelves */}
      <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <h2 data-reveal className="max-w-xl font-display text-[clamp(2.2rem,5.5vw,4.5rem)] leading-[1.02]">
            {t('shelvesTitle')}
          </h2>
          <p data-reveal data-delay="0.1" className="max-w-sm text-[1rem] leading-relaxed text-charcoal/75">
            {t('shelvesBody')}
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CATS.map((c, i) => (
            <ShelfCard key={c} c={c} i={i} />
          ))}
        </div>
      </section>

      {/* Bento: how it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-24 sm:px-10">
        <h2 data-reveal className="font-display text-[clamp(2.2rem,5.5vw,4.5rem)] leading-[1.02]">
          {t('stepsTitle')}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-4 md:auto-rows-[13rem] md:grid-cols-6">
          {steps.map((s, i) => (
            <article
              key={s.n}
              data-reveal={i % 2 ? 'right' : 'left'}
              className={`${s.span} ${STEP_COLORS[i]} group relative flex flex-col justify-between overflow-hidden rounded-[2rem] p-7 transition-transform duration-500 hover:-translate-y-1.5 hover:rotate-[-0.6deg]`}
            >
              <span className="font-display text-6xl opacity-30 transition-opacity group-hover:opacity-60">{s.n}</span>
              {i === 0 && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-16 flex justify-center gap-2">
                  {HERO_PACKS.slice(0, 3).map(({ p }, k) => (
                    <div key={p.id} className="transition-transform duration-500 group-hover:-translate-y-3" style={{ transform: `rotate(${(k - 1) * 8}deg) translateY(${k === 1 ? 0 : 18}px)` }}>
                      <ProductArt product={p} size={170} />
                    </div>
                  ))}
                </div>
              )}
              <div>
                <h3 className="font-display text-[1.7rem] leading-tight">{s.t}</h3>
                <p className="mt-2 max-w-sm text-[0.95rem] leading-relaxed opacity-85">{s.b}</p>
              </div>
              <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 transition-transform duration-700 group-hover:scale-150" />
            </article>
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="relative overflow-hidden bg-forest px-5 py-28 text-center text-cream sm:px-10">
        <div aria-hidden data-speed="0.15" className="absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(217,79,43,0.35),transparent)]" />
        <h2 data-reveal="scale" className="relative font-display text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.98]">
          {t('closingTitle')}
        </h2>
        <button type="button" onClick={enter} data-reveal className="tap relative mt-10 rounded-full bg-sun px-9 py-3 text-[1rem] font-medium text-forest transition-transform hover:-translate-y-0.5">
          {t('chooseShop')}
        </button>
        <p className="relative mt-12 text-[0.85rem] text-botanical">
          Run a store?{' '}
          <Link to="/owner/login" className="underline underline-offset-4 hover:text-cream">
            Sign in to your store
          </Link>
          <span aria-hidden> · </span>
          <Link to="/delivery/login" className="underline underline-offset-4 hover:text-cream">
            Delivery partners
          </Link>
          <span aria-hidden> · </span>
          <Link to="/admin/login" className="underline underline-offset-4 hover:text-cream">
            Platform admin
          </Link>
        </p>
      </section>
    </div>
  )
}
