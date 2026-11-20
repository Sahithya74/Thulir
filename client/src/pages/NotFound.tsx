import { Link } from 'react-router-dom'
import { useT } from '@/services/i18n'

export default function NotFound() {
  const t = useT()
  return (
    <div className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="mt-2 font-display text-3xl text-forest">{t('notFound')}</h1>
        <Link to="/" className="tap mt-6 inline-flex items-center border border-forest bg-forest px-5 text-cream">
          {t('goHome')}
        </Link>
      </div>
    </div>
  )
}
