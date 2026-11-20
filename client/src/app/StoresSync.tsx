import { useEffect } from 'react'
import { demoTowns } from '@thulir/shared'
import { api } from '@/services/api'
import { useLocation } from '@/store/location'
import { useStores } from '@/store/stores'

/** Keeps the store list in step with the chosen location, and refreshes the town list from the API when reachable. */
export function StoresSync() {
  const geo = useLocation((s) => s.location?.geo)
  const setTowns = useLocation((s) => s.setTowns)
  const load = useStores((s) => s.load)

  useEffect(() => {
    const ctrl = new AbortController()
    api
      .towns(ctrl.signal)
      .then((t) => t.length && setTowns(t))
      .catch(() => {
        /* keep the bundled sample towns */
      })
    return () => ctrl.abort()
  }, [setTowns])

  const lat = geo?.lat
  const lng = geo?.lng
  useEffect(() => {
    // Without a location, preview with the first sample town's centre so the scene is never empty.
    void load(lat !== undefined && lng !== undefined ? { lat, lng } : demoTowns[0].center)
  }, [lat, lng, load])

  return null
}
