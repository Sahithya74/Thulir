import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { TopBar } from '@/components/navigation/TopBar'
import { useQualityTier, useWebGLSupport } from '@/hooks/useDevice'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useT, type DictKey } from '@/services/i18n'
import { useDiscovery, type DiscoveryView } from '@/store/discovery'
import { useLocation } from '@/store/location'
import { useStores } from '@/store/stores'
import { PinOverlay } from '@/scenes/neighbourhood/PinOverlay'
import { filterStores } from './filter'
import { ArcView } from './ArcView'
import { DiscoveryPanel } from './DiscoveryPanel'
import { MapView } from './MapView'
import { SceneControls } from './SceneControls'
import { SelectedStorePanel } from './SelectedStorePanel'

// The 3D district (three.js + R3F) is its own chunk; list and map views never pay for it.
const NeighbourhoodCanvas = lazy(() => import('@/scenes/neighbourhood/NeighbourhoodCanvas'))

function SceneSkeleton() {
  const t = useT()
  return (
    <div className="absolute inset-0 grid place-items-center bg-limestone" role="status">
      <div className="text-center">
        <div className="mx-auto h-px w-40 overflow-hidden bg-forest/15">
          <div className="h-full w-1/3 animate-[slide_1.4s_ease-in-out_infinite] bg-terracotta" />
        </div>
        <p className="eyebrow mt-3">{t('loading')}</p>
      </div>
    </div>
  )
}

const TABS: { id: DiscoveryView; label: DictKey }[] = [
  { id: 'arc', label: 'viewArc' },
  { id: 'immersive', label: 'viewImmersive' },
  { id: 'list', label: 'viewList' },
  { id: 'map', label: 'viewMap' },
]

export default function DiscoveryPage() {
  const t = useT()
  const d = useDiscovery(
    useShallow((s) => ({
      view: s.view,
      setView: s.setView,
      query: s.query,
      categories: s.categories,
      openNow: s.openNow,
      fast: s.fast,
      offers: s.offers,
      nearby: s.nearby,
      selectedId: s.selectedId,
    })),
  )
  const stores = useStores((s) => s.stores)
  const hasLocation = useLocation((s) => s.location !== null)
  const openPicker = useLocation((s) => s.openPicker)
  const webgl = useWebGLSupport()
  const tier = useQualityTier()
  const reduced = useReducedMotion()
  const searchRef = useRef<HTMLInputElement>(null)

  // Without WebGL the 3D district is unavailable; everything else works everywhere.
  const view: DiscoveryView = webgl || d.view !== 'immersive' ? d.view : 'arc'

  // The journey starts with a place: ask for one until the customer has chosen.
  useEffect(() => {
    if (!hasLocation) openPicker()
  }, [hasLocation, openPicker])

  const filter = { query: d.query, categories: d.categories, openNow: d.openNow, fast: d.fast, offers: d.offers, nearby: d.nearby }
  const filtered = useMemo(
    () => filterStores(stores, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stores, d.query, d.categories, d.openNow, d.fast, d.offers, d.nearby],
  )
  const visibleIds = useMemo(() => new Set(filtered.map((s) => s.id)), [filtered])

  // Esc leaves a selected store (the location dialog handles its own Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useLocation.getState().pickerOpen && useDiscovery.getState().selectedId) {
        useDiscovery.getState().select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const focusSearch = () => {
    searchRef.current?.focus()
    searchRef.current?.scrollIntoView({ block: 'nearest' })
  }

  const tabs = (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-4 py-2" role="tablist" aria-label="View">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={view === tab.id}
          disabled={tab.id === 'immersive' && !webgl}
          onClick={() => d.setView(tab.id)}
          className={`tap shrink-0 whitespace-nowrap rounded-full px-3.5 text-[0.8rem] font-medium disabled:opacity-40 ${view === tab.id ? 'bg-forest text-cream' : 'text-forest hover:bg-forest/10'}`}
        >
          {t(tab.label)}
        </button>
      ))}
      <Link to="/missions" className="tap ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[0.8rem] font-medium text-terracotta hover:bg-terracotta/10">
        {t('missionsLink')} <span aria-hidden>→</span>
      </Link>
    </div>
  )

  const staged = view !== 'list' && view !== 'arc' // 3D and map share a sidebar + stage layout

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-cream">
      <TopBar />

      {view === 'arc' ? (
        <ArcView ref={searchRef} stores={filtered} tabs={tabs} />
      ) : (
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={`flex min-h-0 flex-col bg-cream ${
            staged ? 'order-2 max-h-[46dvh] border-t border-line lg:order-1 lg:max-h-none lg:w-[390px] lg:shrink-0 lg:border-r lg:border-t-0' : 'order-1 flex-1'
          }`}
        >
          {tabs}
          <Link to="/missions" className="tap flex shrink-0 items-center justify-between border-b border-line bg-limestone/70 px-4 text-[0.82rem] text-forest hover:bg-limestone">
            <span className="font-display text-[0.95rem]">{t('missionsLink')}</span>
            <span aria-hidden>→</span>
          </Link>
          {!webgl && <p className="border-b border-line bg-limestone px-4 py-2 text-[0.78rem] text-charcoal/80">{t('webglMissing')}</p>}
          <div className={`flex min-h-0 flex-1 flex-col ${staged ? '' : 'mx-auto w-full max-w-4xl'}`}>
            <DiscoveryPanel ref={searchRef} stores={filtered} wide={!staged} />
          </div>
        </aside>

        {staged && (
          <main className="relative order-1 min-h-0 flex-1 bg-limestone lg:order-2" aria-label={view === 'map' ? t('viewMap') : t('viewImmersive')}>
            {view === 'immersive' ? (
              <>
                <Suspense fallback={<SceneSkeleton />}>
                  <NeighbourhoodCanvas visibleIds={visibleIds} reducedMotion={reduced} tier={tier} />
                </Suspense>
                <PinOverlay visibleIds={visibleIds} />
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3">
                  <SceneControls onSearch={focusSearch} />
                </div>
              </>
            ) : (
              <MapView stores={stores} visibleIds={visibleIds} />
            )}

            <div className="pointer-events-none absolute inset-x-3 bottom-20 top-3 z-30 flex items-end justify-end sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-24 sm:w-[340px] sm:items-start">
              <div className="pointer-events-auto max-h-full w-full">
                <SelectedStorePanel />
              </div>
            </div>
          </main>
        )}
      </div>
      )}

      {!staged && view !== 'arc' && d.selectedId && (
        <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[360px]">
          <SelectedStorePanel />
        </div>
      )}
    </div>
  )
}
