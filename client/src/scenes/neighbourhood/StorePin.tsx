import { isOpenAt, formatPaise, type StoreWithDelivery } from '@thulir/shared'
import { categoryKey, pick, useLang, useT } from '@/services/i18n'

interface Props {
  store: StoreWithDelivery
  hovered: boolean
  selected: boolean
  dimmed: boolean
  /** Small screens: show a dot, reveal the name only when active. */
  compact?: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

/** DOM hotspot positioned over the 3D scene. It is a real button, so it is focusable and announced. */
export function StorePin({ store, hovered, selected, dimmed, compact = false, onHover, onSelect }: Props) {
  const t = useT()
  const lang = useLang()
  const open = isOpenAt(store.hours)
  const name = pick(store.name, lang)
  const showCard = hovered && !selected

  return (
    <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: dimmed ? 0.35 : store.delivery.deliverable ? 1 : 0.6, transition: 'opacity .3s' }}>
      {showCard && (
        <div
          role="presentation"
          className="mb-2 w-60 border bg-cream px-3.5 py-3 text-left shadow-[0_10px_30px_-12px_rgba(15,42,67,0.45)]"
          style={{ borderColor: 'rgb(15 42 67 / 0.16)', pointerEvents: 'none' }}
        >
          <div className="eyebrow">{t(categoryKey[store.category])}</div>
          <div className="mt-0.5 font-display text-[1.05rem] leading-tight text-forest">{name}</div>
          <div className="mt-2 flex items-center gap-2 text-[0.75rem] text-charcoal">
            <span className="inline-flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${open ? 'bg-olive' : 'bg-terracotta'}`} />
              {open ? t('open') : t('closed')}
            </span>
            <span aria-hidden>·</span>
            <span>
              {store.delivery.etaMin} {t('min')}
            </span>
            <span aria-hidden>·</span>
            <span>{(store.delivery.distanceM / 1000).toFixed(1)} km</span>
          </div>
          <div className="mt-1.5 text-[0.75rem] text-charcoal/80">★ {store.rating.toFixed(1)} ({store.reviewCount})</div>
          {!store.delivery.deliverable && <div className="mt-1.5 text-[0.75rem] font-medium text-terracotta">{t('notDeliverable')}</div>}
          {store.offers[0] && <div className="mt-1.5 text-[0.75rem] font-medium text-terracotta">{pick(store.offers[0].label, lang)}</div>}
          <div className="mt-1.5 text-[0.6875rem] text-charcoal/60">
            {t('deliveryFee')} {formatPaise(store.deliveryFeePaise)}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => onSelect(store.id)}
        onMouseEnter={() => onHover(store.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(store.id)}
        onBlur={() => onHover(null)}
        aria-pressed={selected}
        aria-label={`${name}, ${t(categoryKey[store.category])}, ${open ? t('open') : t('closed')}, ${store.delivery.etaMin} ${t('min')}`}
        className={`tap inline-flex items-center justify-center gap-2 whitespace-nowrap border text-[0.78rem] font-medium tracking-wide transition-colors ${
          compact && !(selected || hovered) ? 'h-11 w-11 rounded-full px-0' : 'px-3 py-1.5'
        } ${selected || hovered ? 'border-forest bg-forest text-cream' : 'border-forest/30 bg-cream/95 text-forest'}`}
        style={{ pointerEvents: 'auto' }}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${open ? 'bg-botanical' : 'bg-terracotta'}`} />
        {(!compact || selected || hovered) && name}
      </button>
      <span aria-hidden className="block h-4 w-px bg-forest/50" />
    </div>
  )
}
