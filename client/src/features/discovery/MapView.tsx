import { useMemo } from 'react'
import { isOpenAt, metresFrom, type StoreWithDelivery } from '@thulir/shared'
import { categoryKey, pick, useLang, useT } from '@/services/i18n'
import { useDiscovery } from '@/store/discovery'
import { useLocation } from '@/store/location'
import { useIsSmall } from '@/hooks/useDevice'

/**
 * Schematic distance map: the customer sits at the centre, stores are placed by their true bearing and
 * distance on concentric rings. It is deliberately NOT a street map (no tiles, no routing) and says so.
 */
export function MapView({ stores, visibleIds }: { stores: StoreWithDelivery[]; visibleIds: Set<string> }) {
  const t = useT()
  const lang = useLang()
  const small = useIsSmall()
  const location = useLocation((s) => s.location)
  const selectedId = useDiscovery((s) => s.selectedId)
  const hoveredId = useDiscovery((s) => s.hoveredId)
  const select = useDiscovery((s) => s.select)
  const hover = useDiscovery((s) => s.hover)

  const origin = location?.geo
  const placed = useMemo(() => {
    if (!origin) return []
    return stores.map((s) => ({ store: s, ...metresFrom(origin, s.geo) }))
  }, [stores, origin])

  const extent = useMemo(() => {
    const far = Math.max(1000, ...placed.map((p) => Math.hypot(p.east, p.north)))
    return Math.ceil((far * 1.18) / 500) * 500
  }, [placed])

  if (!origin) {
    return <div className="grid h-full place-items-center px-6 text-center text-[0.9rem] text-charcoal/70">{t('locIntro')}</div>
  }

  const pct = (m: number) => 50 + (m / extent) * 50
  const rings = Array.from({ length: Math.floor(extent / 500) }, (_, i) => (i + 1) * 500)
  const selected = placed.find((p) => p.store.id === selectedId)

  return (
    <div className="relative h-full w-full bg-limestone [container-type:size]">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 'min(100cqw, 100cqh)', height: 'min(100cqw, 100cqh)' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgb(43 26 18 / 0.12)" strokeWidth="0.2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgb(43 26 18 / 0.12)" strokeWidth="0.2" />
          {rings.map((r) => (
            <g key={r}>
              <circle cx="50" cy="50" r={(r / extent) * 50} fill="none" stroke="rgb(43 26 18 / 0.2)" strokeWidth="0.25" strokeDasharray="0.8 1.2" />
              <text x="50.6" y={50 - (r / extent) * 50 - 0.7} fontSize="1.9" fill="rgb(41 44 41 / 0.55)">
                {r >= 1000 ? `${r / 1000} km` : `${r} m`}
              </text>
            </g>
          ))}
          {selected && (
            <circle
              cx={pct(selected.east)}
              cy={100 - pct(selected.north)}
              r={(selected.store.deliveryRadiusM / extent) * 50}
              fill="rgb(119 133 107 / 0.10)"
              stroke="#3f7a3a"
              strokeWidth="0.3"
              strokeDasharray="1.2 0.8"
            />
          )}
        </svg>

        {/* customer */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-label={t('you')}>
          <span className="relative block h-3.5 w-3.5 rounded-full border-2 border-cream bg-terracotta shadow" />
          <span className="eyebrow absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap !text-terracotta">{t('you')}</span>
        </div>

        {placed.map(({ store, east, north }) => {
          const active = selectedId === store.id || hoveredId === store.id
          const open = isOpenAt(store.hours)
          const dim = !visibleIds.has(store.id)
          const ok = store.delivery.deliverable
          return (
            <button
              key={store.id}
              type="button"
              onClick={() => select(store.id)}
              onMouseEnter={() => hover(store.id)}
              onMouseLeave={() => hover(null)}
              onFocus={() => hover(store.id)}
              onBlur={() => hover(null)}
              aria-pressed={selectedId === store.id}
              aria-label={`${pick(store.name, lang)}, ${t(categoryKey[store.category])}, ${(store.delivery.distanceM / 1000).toFixed(1)} km, ${ok ? t('deliverableHere') : t('notDeliverable')}`}
              className={`tap absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 border px-2 text-[0.75rem] font-medium transition-colors ${
                active ? 'z-10 border-forest bg-forest text-cream' : 'border-forest/30 bg-cream text-forest'
              } ${dim ? 'opacity-35' : ok ? '' : 'opacity-70'} ${small && !active ? 'h-11 w-11 justify-center rounded-full px-0' : ''}`}
              style={{ left: `${pct(east)}%`, top: `${100 - pct(north)}%` }}
            >
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? (open ? 'bg-botanical' : 'bg-olive') : 'border border-terracotta bg-transparent'}`} />
              {(!small || active) && <span className="whitespace-nowrap">{pick(store.name, lang)}</span>}
            </button>
          )
        })}
      </div>
      <p className="absolute bottom-2 left-3 right-3 text-center text-[0.7rem] text-charcoal/65">{t('mapNote')}</p>
    </div>
  )
}
