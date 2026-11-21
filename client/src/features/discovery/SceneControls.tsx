import { useT } from '@/services/i18n'
import { useDiscovery } from '@/store/discovery'
import { cameraBus } from '@/scenes/neighbourhood/cameraBus'

function Btn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="tap inline-flex items-center gap-1.5 px-3 text-[0.8rem] font-medium text-forest transition-colors hover:bg-forest hover:text-cream"
    >
      {children}
    </button>
  )
}

export function SceneControls({ onSearch }: { onSearch: () => void }) {
  const t = useT()
  const selected = useDiscovery((s) => s.selectedId)
  const select = useDiscovery((s) => s.select)
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2">
      {!selected && <p className="pointer-events-none hidden text-[0.72rem] tracking-wide text-forest/70 sm:block">{t('dragHint')}</p>}
      <div role="toolbar" aria-label="3D view controls" className="pointer-events-auto flex flex-wrap items-stretch divide-x divide-forest/15 border border-line bg-cream shadow-[0_14px_36px_-18px_rgba(43, 26, 18,0.5)]">
        <Btn onClick={() => cameraBus.emit('explore')} label={t('explore')}>
          {t('explore')}
        </Btn>
        <Btn onClick={() => cameraBus.emit('zoomOut')} label={t('zoomOut')}>
          −
        </Btn>
        <Btn onClick={() => cameraBus.emit('zoomIn')} label={t('zoomIn')}>
          +
        </Btn>
        <Btn onClick={() => cameraBus.emit('reset')} label={t('resetView')}>
          {t('resetView')}
        </Btn>
        {selected && (
          <Btn onClick={() => select(null)} label={t('backToDiscovery')}>
            ← {t('backToDiscovery')}
          </Btn>
        )}
        <Btn onClick={onSearch} label={t('search')}>
          {t('search')}
        </Btn>
      </div>
    </div>
  )
}
