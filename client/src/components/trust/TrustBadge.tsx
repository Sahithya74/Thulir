import type { VerificationStatus } from '@thulir/shared'
import { useT } from '@/services/i18n'

/**
 * A badge that explains itself. Every status must say what evidence stands behind it.
 * In the prototype, every store is a demo, so the only status that can render is `demo`.
 */
export function TrustBadge({ status }: { status: VerificationStatus }) {
  const t = useT()
  if (status !== 'demo') {
    // Real verification flows arrive with the admin portal; until then nothing may claim it.
    return null
  }
  return (
    <details className="group border border-terracotta/50 bg-terracotta/10 text-[0.8125rem]">
      <summary className="tap flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium text-forest marker:hidden">
        <span aria-hidden className="inline-block h-2 w-2 rotate-45 bg-terracotta" />
        {t('verificationDemo')}
        <span aria-hidden className="ml-auto text-charcoal/50 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <p className="border-t border-terracotta/30 px-3 py-2.5 leading-relaxed text-charcoal/85">{t('trustDemoBody')}</p>
    </details>
  )
}
