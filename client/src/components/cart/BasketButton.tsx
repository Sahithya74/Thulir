import { useT } from '@/services/i18n'
import { cartCount, useCart } from '@/store/cart'

/** How full the basket looks: it steps up as the item count grows, so the icon itself reflects the basket. */
function fillLevel(n: number): 0 | 1 | 2 | 3 {
  return n === 0 ? 0 : n <= 3 ? 1 : n <= 8 ? 2 : 3
}

function BasketIcon({ level }: { level: 0 | 1 | 2 | 3 }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      {/* contents, drawn behind the front of the basket */}
      {level >= 1 && <circle cx="11" cy="11" r="3.3" fill="#c98255" />}
      {level >= 2 && (
        <>
          <circle cx="17" cy="10" r="3.1" fill="#77856b" />
          <rect x="12.5" y="6.2" width="4" height="7" rx="1.6" fill="#a8b89a" />
        </>
      )}
      {level >= 3 && (
        <>
          <circle cx="8.6" cy="9.2" r="2.8" fill="#b6513a" />
          <rect x="17.8" y="5" width="4.4" height="8" rx="1.8" fill="#d9b44a" />
        </>
      )}
      <path d="M5.5 12.5h17l-1.8 9.2a1.6 1.6 0 0 1-1.6 1.3H8.9a1.6 1.6 0 0 1-1.6-1.3L5.5 12.5Z" fill="#f5f2ea" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 12.5 14 5l4 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity={level === 0 ? 1 : 0} />
      <path d="M10.5 15.5v4.2M14 15.5v4.2M17.5 15.5v4.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".55" />
    </svg>
  )
}

/** The basket icon in the top bar: opens the drawer, shows the count, and is the target of the add-to-basket flight. */
export function BasketButton() {
  const t = useT()
  const count = useCart((s) => cartCount(s.lines))
  const setOpen = useCart((s) => s.setOpen)
  return (
    <button
      type="button"
      data-basket-target
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-label={`${t('basket')}: ${t(count === 1 ? 'itemN' : 'itemsN', { n: count })}`}
      className="tap relative inline-flex items-center gap-1.5 px-2.5 text-[0.8125rem] text-forest hover:bg-forest/10"
    >
      <BasketIcon level={fillLevel(count)} />
      <span className="hidden sm:inline">{t('basket')}</span>
      {count > 0 && (
        <span className="absolute -right-0.5 top-1 grid min-w-[1.15rem] place-items-center rounded-full bg-terracotta px-1 text-[0.66rem] font-semibold leading-[1.15rem] text-white" aria-hidden>
          {count}
        </span>
      )}
    </button>
  )
}
