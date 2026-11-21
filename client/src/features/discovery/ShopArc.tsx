import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isOpenAt, type StoreCategory, type StoreWithDelivery } from '@thulir/shared'
import { ProductArt } from '@/components/products/ProductArt'
import type { PackSource } from '@/components/products/packDesign'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { categoryKey, pick, useLang, useT } from '@/services/i18n'
import { dur, gsap } from '@/services/motion'
import { useDiscovery } from '@/store/discovery'
import { enterStore } from './enterStore'

const L = (en: string, ta: string) => ({ en, ta })
const pack = (id: string, en: string, ta: string, brand: string, unit: string, department: PackSource['department'], shape: PackSource['shape'], color: string): PackSource => ({
  id,
  name: L(en, ta),
  brand,
  unit,
  department,
  shape,
  color,
  veg: true,
})

/** Three representative packs per kind of shop, so each card shows what you will find inside. */
const SHOWCASE: Record<StoreCategory, PackSource[]> = {
  supermarket: [
    pack('a-rice', 'Ponni Rice', 'பொன்னி அரிசி', 'Kaveri', '5 kg', 'pantry', 'pouch', '#f3d9a0'),
    pack('a-oil', 'Groundnut Oil', 'கடலை எண்ணெய்', 'Selvam', '1 L', 'pantry', 'bottle', '#e6a817'),
    pack('a-tea', 'Assam Tea', 'தேநீர்', 'Chai Co', '250 g', 'beverages', 'box', '#b7332b'),
  ],
  provision: [
    pack('b-salt', 'Crystal Salt', 'உப்பு', 'Thulir Pantry', '1 kg', 'pantry', 'pouch', '#e8eef5'),
    pack('b-dal', 'Toor Dal', 'துவரம் பருப்பு', 'Kaveri', '1 kg', 'pantry', 'pouch', '#e9b949'),
    pack('b-spice', 'Chilli Powder', 'மிளகாய்த் தூள்', 'Selvam', '200 g', 'pantry', 'pouch', '#c8372d'),
  ],
  fruit_veg: [
    pack('c-banana', 'Banana', 'வாழைப்பழம்', 'Farm', '1 dozen', 'fresh', 'crate', '#f1cf3b'),
    pack('c-tomato', 'Tomato', 'தக்காளி', 'Farm', '1 kg', 'fresh', 'crate', '#d9402e'),
    pack('c-spinach', 'Spinach', 'கீரை', 'Farm', '1 bunch', 'fresh', 'crate', '#3f8f3a'),
  ],
  bakery: [
    pack('d-bread', 'Milk Bread', 'பால் ரொட்டி', 'Madhuram', '400 g', 'bakery', 'pouch', '#e2b36b'),
    pack('d-cookie', 'Butter Cookies', 'வெண்ணெய் பிஸ்கட்', 'Madhuram', '200 g', 'snacks', 'box', '#d9742a'),
    pack('d-bun', 'Honey Buns', 'தேன் பன்', 'Madhuram', '4 pcs', 'bakery', 'pouch', '#cf8b4a'),
  ],
  dairy: [
    pack('e-milk', 'Fresh Milk', 'பால்', 'Pasumai', '1 L', 'chilled', 'carton', '#3b8fd6'),
    pack('e-curd', 'Set Curd', 'தயிர்', 'Pasumai', '500 g', 'chilled', 'tub', '#f4f1e8'),
    pack('e-butter', 'Salted Butter', 'வெண்ணெய்', 'Pasumai', '100 g', 'chilled', 'bar', '#f2d36b'),
  ],
  household: [
    pack('f-wash', 'Detergent', 'சலவை பவுடர்', 'Illam', '1 kg', 'household', 'box', '#2f7fd0'),
    pack('f-dish', 'Dish Wash', 'பாத்திரம் சோப்', 'Illam', '500 ml', 'household', 'bottle', '#3fae6a'),
    pack('f-floor', 'Floor Cleaner', 'தரை சுத்தம்', 'Illam', '1 L', 'household', 'bottle', '#7a4fd0'),
  ],
}

const TONES: Record<StoreCategory, [string, string]> = {
  supermarket: ['#3f7a3a', '#1f4a22'],
  provision: ['#d94f2b', '#8f2c12'],
  fruit_veg: ['#7aa83a', '#3f6a1c'],
  bakery: ['#e8842a', '#a8480f'],
  dairy: ['#2fa4c4', '#17586f'],
  household: ['#7a4fd0', '#43267f'],
}

const PACK_SLOTS = [
  { left: '-4%', bottom: '34%', size: 0.5, z: 70, rot: -10, depth: 14 },
  { left: '27%', bottom: '38%', size: 0.62, z: 110, rot: 3, depth: 26 },
  { left: '58%', bottom: '32%', size: 0.5, z: 80, rot: 9, depth: 18 },
]

const STEP = 0.6 // radians between neighbouring cards on the arc

interface CardProps {
  store: StoreWithDelivery
  active: boolean
  /** Packs are painted only for cards near the centre; painting is synchronous canvas work. */
  near: boolean
  w: number
  setRef: (el: HTMLDivElement | null) => void
  onPick: () => void
}

function ShopCard({ store, active, near, w, setRef, onPick }: CardProps) {
  const t = useT()
  const lang = useLang()
  const [from, to] = TONES[store.category]
  const open = isOpenAt(store.hours)
  const packs = SHOWCASE[store.category]
  const h = Math.round(w * 1.42)
  return (
    <div
      ref={setRef}
      onClick={onPick}
      role="group"
      aria-label={pick(store.name, lang)}
      className="absolute left-1/2 top-1/2 cursor-pointer select-none [transform-style:preserve-3d]"
      style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, willChange: 'transform' }}
    >
      <div className="absolute inset-0 rounded-[2rem] text-cream [transform-style:preserve-3d]">
        <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[2rem] shadow-[0_40px_60px_-24px_rgba(43,26,18,0.55)]" style={{ background: `linear-gradient(158deg, ${from} 0%, ${to} 100%)` }}>
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 -left-10 h-60 w-60 rounded-full bg-black/10" />
        </div>

        <div className="relative flex items-center justify-between px-5 pt-5">
          <span className="rounded-full bg-black/20 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] [html[lang=ta]_&]:normal-case [html[lang=ta]_&]:tracking-normal">
            {t(categoryKey[store.category])}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.72rem] font-semibold text-forest">
            <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-olive' : 'bg-terracotta'}`} />
            {open ? t('open') : t('closed')}
          </span>
        </div>

        <h3 className="relative mt-4 px-5 font-display text-[1.95rem] leading-[1.02]" style={{ fontSize: Math.max(24, w * 0.095) }}>
          {pick(store.name, lang)}
        </h3>
        <p className="relative mt-1.5 px-5 text-[0.82rem] leading-snug text-cream/85">{pick(store.tagline, lang)}</p>

        {/* Packs sit at different depths so they slide against the card as it turns. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[34%] [transform-style:preserve-3d]">
          {near && packs.map((p, i) => {
            const s = PACK_SLOTS[i]
            const size = Math.round(w * s.size)
            return (
              <div
                key={p.id}
                className="arc-pack absolute"
                style={{
                  left: s.left,
                  bottom: s.bottom,
                  transform: `translate3d(calc(var(--px, 0) * ${s.depth}px), calc(var(--py, 0) * ${s.depth * 0.6}px), ${s.z}px) rotate(${s.rot}deg)`,
                }}
              >
                <div className={active ? 'arc-bob' : ''} style={{ animationDelay: `${i * 0.5}s` }}>
                  <ProductArt product={p} size={size} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-2xl bg-black/25 px-4 py-3 text-[0.78rem] backdrop-blur-sm">
          <span className="font-semibold">
            {store.delivery.etaMin} {t('min')} · {(store.delivery.distanceM / 1000).toFixed(1)} km
          </span>
          <span className="flex items-center gap-2">
            {store.offers[0] && <span className="max-w-[7rem] truncate rounded-full bg-sun px-2.5 py-0.5 text-[0.68rem] font-semibold text-forest">{pick(store.offers[0].label, lang)}</span>}
            <span>★ {store.rating.toFixed(1)}</span>
          </span>
        </div>

        {!store.delivery.deliverable && <div className="absolute inset-0 rounded-[2rem] bg-cream/55" aria-hidden />}
      </div>
    </div>
  )
}

interface Props {
  stores: StoreWithDelivery[]
}

/** Scroll / drag / key driven arc of shop cards. The centre card is the one you are about to walk into. */
export function ShopArc({ stores }: Props) {
  const t = useT()
  const lang = useLang()
  const nav = useNavigate()
  const reduced = useReducedMotion()
  const select = useDiscovery((s) => s.select)
  const stage = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const proxy = useRef({ pos: 0 })
  const dims = useRef({ w: 300, R: 440, vw: 1200 })
  const [w, setW] = useState(300)
  const [active, setActive] = useState(0)
  const n = stores.length
  const nRef = useRef(n)
  nRef.current = n

  const render = useCallback(() => {
    const pos = proxy.current.pos
    const { R } = dims.current
    cards.current.forEach((el, i) => {
      if (!el) return
      const d = i - pos
      const ad = Math.abs(d)
      if (ad > 3.6) {
        el.style.visibility = 'hidden'
        return
      }
      el.style.visibility = 'visible'
      const th = d * STEP
      const x = Math.sin(th) * R
      const z = (Math.cos(th) - 1) * R
      const y = Math.min(ad, 3) * Math.min(ad, 3) * 6
      const s = 1 - Math.min(ad, 3) * 0.06
      el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateY(${(-th * 180) / Math.PI}deg) scale(${s})`
      el.style.opacity = ad < 2.2 ? '1' : String(Math.max(0, 1 - (ad - 2.2) * 0.8))
      el.style.zIndex = String(100 - Math.round(ad * 10))
    })
    const idx = Math.max(0, Math.min(nRef.current - 1, Math.round(pos)))
    setActive((a) => (a === idx ? a : idx))
  }, [])

  const go = useCallback(
    (target: number, fast = false) => {
      const to = Math.max(0, Math.min(nRef.current - 1, Math.round(target)))
      gsap.killTweensOf(proxy.current)
      gsap.to(proxy.current, { pos: to, duration: dur(fast ? 0.45 : 0.85), ease: 'power3.out', onUpdate: render })
      if (dur(1) === 0) {
        proxy.current.pos = to
        render()
      }
    },
    [render],
  )

  // Measure the stage and lay the arc out for it.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => {
      const vw = el.clientWidth
      const cw = Math.max(220, Math.min(320, Math.round(vw * 0.72), Math.round(el.clientHeight / 1.42 - 12)))
      dims.current = { w: cw, R: cw * 1.55, vw }
      setW(cw)
      render()
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [render])

  // The list changed (search, filters): stay in range and re-render.
  useEffect(() => {
    cards.current.length = n
    const clamped = Math.max(0, Math.min(n - 1, Math.round(proxy.current.pos)))
    proxy.current.pos = clamped
    render()
  }, [n, render, stores])

  // Keep the shared selection in step with the centre card.
  useEffect(() => {
    const s = stores[active]
    if (s) select(s.id)
  }, [active, stores, select])

  // Wheel / trackpad: continuous scrub, then settle on the nearest card.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    let settle = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      gsap.killTweensOf(proxy.current)
      proxy.current.pos = Math.max(0, Math.min(nRef.current - 1, proxy.current.pos + d * 0.0042))
      render()
      window.clearTimeout(settle)
      settle = window.setTimeout(() => go(proxy.current.pos, true), 120)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.clearTimeout(settle)
    }
  }, [go, render])

  // Pointer drag with a little momentum, and pointer parallax for the packs.
  const drag = useRef<{ x: number; pos: number; moved: boolean; t: number; v: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, pos: proxy.current.pos, moved: false, t: performance.now(), v: 0 }
    gsap.killTweensOf(proxy.current)
  }
  const onMove = (e: React.PointerEvent) => {
    const el = stage.current
    if (el && !reduced) {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--px', String(((e.clientX - r.left) / r.width - 0.5) * 2))
      el.style.setProperty('--py', String(((e.clientY - r.top) / r.height - 0.5) * 2))
    }
    const dr = drag.current
    if (!dr) return
    const dx = e.clientX - dr.x
    if (Math.abs(dx) > 6 && !dr.moved) {
      dr.moved = true
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    }
    if (!dr.moved) return
    const now = performance.now()
    dr.v = (dx / dims.current.w) * -1.6
    dr.t = now
    proxy.current.pos = Math.max(-0.4, Math.min(nRef.current - 0.6, dr.pos - (dx / dims.current.w) * 1.6))
    render()
  }
  const onUp = () => {
    const dr = drag.current
    drag.current = null
    if (dr?.moved) go(proxy.current.pos + dr.v * 0.25)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(active + 1, true)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(active - 1, true)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(n - 1)
    else return
    e.preventDefault()
  }

  const current = stores[active]
  const reason = useMemo(() => (current && !current.delivery.deliverable ? t('cannotEnter') : ''), [current, t])
  const enter = () => {
    if (!current) return
    select(current.id)
    enterStore(current, lang, nav, false)
  }

  if (n === 0) return <p className="grid flex-1 place-items-center px-6 text-center text-[0.95rem] text-charcoal/70">{t('noStores')}</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={stage}
        tabIndex={0}
        role="listbox"
        aria-label={t('stores')}
        aria-activedescendant={current ? `arc-${current.id}` : undefined}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative min-h-0 flex-1 cursor-grab touch-pan-y overflow-hidden outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-terracotta/60 [perspective:1500px]"
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(60%_80%_at_50%_100%,rgba(43,26,18,0.16),transparent)]" />
        {stores.map((s, i) => (
          <div id={`arc-${s.id}`} key={s.id} role="option" aria-selected={i === active} className="contents">
            <ShopCard
              store={s}
              active={i === active}
              near={Math.abs(i - active) <= 2}
              w={w}
              setRef={(el) => {
                cards.current[i] = el
              }}
              onPick={() => {
                if (drag.current?.moved) return
                if (i === active) enter()
                else go(i)
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-3 px-4 pb-5 pt-3">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => go(active - 1, true)} disabled={active === 0} aria-label="Previous shop" className="tap grid h-11 w-11 place-items-center rounded-full border border-forest/25 text-lg transition hover:bg-forest hover:text-cream disabled:opacity-30">
            ←
          </button>
          <div className="flex items-center gap-1.5" aria-hidden>
            {stores.map((s, i) => (
              <button key={s.id} type="button" tabIndex={-1} onClick={() => go(i)} className={`h-2 rounded-full transition-all ${i === active ? 'w-7 bg-terracotta' : 'w-2 bg-forest/25 hover:bg-forest/50'}`} />
            ))}
          </div>
          <button type="button" onClick={() => go(active + 1, true)} disabled={active >= n - 1} aria-label="Next shop" className="tap grid h-11 w-11 place-items-center rounded-full border border-forest/25 text-lg transition hover:bg-forest hover:text-cream disabled:opacity-30">
            →
          </button>
        </div>
        <button
          type="button"
          onClick={enter}
          disabled={!current?.delivery.deliverable}
          className="tap rounded-full bg-forest px-9 py-3 text-[0.98rem] font-medium text-cream shadow-[0_16px_30px_-12px_rgba(43,26,18,0.6)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
        >
          {t('enterStore')} · {current ? pick(current.name, lang) : ''}
        </button>
        {reason && <p className="text-[0.78rem] text-terracotta">{reason}</p>}
      </div>
    </div>
  )
}
