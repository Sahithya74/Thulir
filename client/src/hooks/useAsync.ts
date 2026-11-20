import { useEffect, useState } from 'react'
import { ApiError } from '@/services/api'
import type { Sourced } from '@/services/catalogApi'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; code: string; message: string }
  | { status: 'ready'; data: T; source: Sourced<T>['source'] }

/**
 * Run an abortable loader whenever `deps` change. Stale responses are dropped (AbortController), so fast typing or
 * quick navigation never shows an older result over a newer one.
 */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<Sourced<T>>, deps: unknown[], enabled = true) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }))
    load(ctrl.signal)
      .then((r) => !ctrl.signal.aborted && setState({ status: 'ready', data: r.data, source: r.source }))
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError' || ctrl.signal.aborted) return
        const err = e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', 'Something went wrong')
        setState({ status: 'error', code: err.code, message: err.message })
      })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce])

  return { state, retry: () => setNonce((n) => n + 1) }
}
