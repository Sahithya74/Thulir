import type { CustomerEligibility } from '@thulir/shared'
import type { DictKey, Lang } from '@/services/i18n'

export type Tone = 'ok' | 'warn' | 'muted'
type Translate = (key: DictKey, vars?: Record<string, string | number>) => string

/** dd MMM yyyy in the viewer's language, fixed to UTC so a date never shifts with the browser's time zone. */
export function formatDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`))
}

export interface FreshnessInfo {
  /** Short status chip. */
  chip: string
  tone: Tone
  /** Longer line about shelf life, if any. */
  detail: string | null
}

/** Turn the server's customer-facing verdict into words. Never invents data the server did not send. */
export function describeFreshness(e: CustomerEligibility, lang: Lang, t: Translate): FreshnessInfo {
  if (e.status === 'out_of_stock') return { chip: t('outOfStock'), tone: 'muted', detail: null }

  let detail: string | null = null
  if (e.bestBefore) {
    const date = formatDate(e.bestBefore, lang)
    if (e.status === 'near_expiry') {
      const when =
        e.daysToExpiry === 1
          ? t('bestBeforeTomorrow')
          : e.daysToExpiry === 0
            ? t('bestBefore', { date })
            : t('bestBeforeDays', { n: e.daysToExpiry ?? 0 })
      detail = `${when} · ${date}`
    } else {
      detail = t('bestBefore', { date })
    }
  }

  if (e.status === 'low_stock') return { chip: t('onlyLeft', { n: e.sellableQty }), tone: 'warn', detail }
  if (e.status === 'near_expiry') return { chip: t('shortShelf'), tone: 'warn', detail }
  return { chip: t('inStock'), tone: 'ok', detail }
}
