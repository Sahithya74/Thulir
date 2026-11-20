import { Link } from 'react-router-dom'
import { useT } from '@/services/i18n'
import { BasketButton } from '@/components/cart/BasketButton'
import { useCart } from '@/store/cart'
import { useUiStore } from '@/store/ui'
import { useLocation } from '@/store/location'
import { pick, useLang } from '@/services/i18n'

export function Wordmark({ light = false }: { light?: boolean }) {
  const t = useT()
  return (
    <Link to="/" className={`font-display text-[1.45rem] leading-none tracking-[0.08em] [html[lang=ta]_&]:tracking-normal ${light ? 'text-cream' : 'text-forest'}`} aria-label={`${t('brand')} — home`}>
      {t('brand').toUpperCase()}
    </Link>
  )
}

export function LanguageSwitch() {
  const lang = useUiStore((s) => s.lang)
  const setLang = useUiStore((s) => s.setLang)
  const t = useT()
  return (
    <div role="group" aria-label={t('language')} className="inline-flex border border-forest/25 text-[0.8125rem]">
      {(['en', 'ta'] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`tap px-3 transition-colors ${lang === l ? 'bg-forest text-cream' : 'text-forest hover:bg-forest/10'}`}
        >
          {l === 'en' ? 'EN' : 'தமிழ்'}
        </button>
      ))}
    </div>
  )
}

export function LocationChip() {
  const t = useT()
  const lang = useLang()
  const location = useLocation((s) => s.location)
  const open = useLocation((s) => s.openPicker)
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      className="tap flex min-w-0 max-w-[13rem] items-center gap-1.5 border border-forest/25 px-2.5 text-left text-[0.78rem] text-forest hover:bg-forest/10 sm:max-w-[18rem]"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-terracotta">
        <path d="M8 14.5s4.5-4.2 4.5-8a4.5 4.5 0 1 0-9 0c0 3.8 4.5 8 4.5 8Z" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="6.5" r="1.6" fill="currentColor" />
      </svg>
      <span className="min-w-0">
        <span className="eyebrow block !text-[0.58rem] leading-none">{t('deliveringTo')}</span>
        <span className="block truncate font-medium leading-tight">{location ? pick(location.label, lang) : t('chooseLocation')}</span>
      </span>
    </button>
  )
}

export function TopBar() {
  const t = useT()
  const announcement = useCart((s) => s.announcement)
  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-cream px-4 sm:px-6">
      <Wordmark />
      <span className="hidden border border-terracotta/60 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-terracotta lg:inline">
        {t('demoData')}
      </span>
      <LocationChip />
      <div className="ml-auto flex items-center gap-2">
        <Link to="/missions" className="tap hidden items-center px-3 text-[0.8125rem] text-forest hover:bg-forest/10 md:inline-flex">
          {t('missionsLink')}
        </Link>
        <Link to="/search" className="tap inline-flex items-center gap-2 px-3 text-[0.8125rem] text-forest hover:bg-forest/10" aria-label={t('search')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.7" stroke="currentColor" strokeWidth="1.4" />
            <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">{t('search')}</span>
        </Link>
        <LanguageSwitch />
        <BasketButton />
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </header>
  )
}
