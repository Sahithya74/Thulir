import type { CartIssue } from '@thulir/shared'
import { pick, useLang, useT, type DictKey } from '@/services/i18n'
import { useCart } from '@/store/cart'

const KEY: Record<CartIssue['issue'], DictKey> = {
  UNAVAILABLE: 'issueUnavailable',
  OUT_OF_STOCK: 'issueOutOfStock',
  QTY_REDUCED: 'issueReduced',
  NOT_DELIVERABLE: 'issueNotDeliverable',
  INVALID_QTY: 'issueInvalid',
}

/**
 * Tells the customer exactly what the server changed in their basket. Corrections are adopted automatically, but never
 * silently: every removed or reduced item is listed here until dismissed.
 */
export function CartNotices() {
  const t = useT()
  const lang = useLang()
  const notices = useCart((s) => s.notices)
  const dismiss = useCart((s) => s.dismissNotices)
  if (notices.length === 0) return null
  return (
    <div role="alert" className="border-l-2 border-terracotta bg-terracotta/10 px-3 py-2.5 text-[0.85rem]">
      <p className="font-medium text-forest">{t('changesTitle')}</p>
      <ul className="mt-1 space-y-1">
        {notices.map((n) => (
          <li key={`${n.issue.productId}-${n.issue.issue}-${n.at}`}>
            {t(KEY[n.issue.issue], { name: pick(n.issue.name, lang), n: n.issue.allowedQty })}
          </li>
        ))}
      </ul>
      <button type="button" onClick={dismiss} className="tap mt-1 -ml-2 px-2 text-[0.78rem] text-terracotta underline underline-offset-2">
        {t('dismiss')}
      </button>
    </div>
  )
}
