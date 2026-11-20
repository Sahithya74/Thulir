import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { demoStores, type SessionUser } from '@thulir/shared'
import { Wordmark } from '@/components/navigation/TopBar'
import { ApiError } from '@/services/api'
import { authApi, ownerApi } from '@/services/ownerApi'
import { OwnerContext, type OwnerCtx } from './ownerUi'

const NAV = [
  ['/owner', 'Today', true],
  ['/owner/orders', 'Orders', false],
  ['/owner/inventory', 'Stock', false],
  ['/owner/expiry', 'Expiry', false],
  ['/owner/alerts', 'Alerts', false],
  ['/owner/settings', 'Rules', false],
  ['/owner/activity', 'Activity', false],
] as const

/**
 * Guard + frame for the owner portal. The browser only decides what to SHOW; every request is still checked by the
 * server (signed in, store owner, owns this store, CSRF on writes).
 */
export default function OwnerLayout() {
  const nav = useNavigate()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    authApi
      .me()
      .then((u) => (u.role === 'store_owner' && u.storeIds.length > 0 ? setUser(u) : nav('/owner/login', { replace: true })))
      .catch((e: unknown) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) nav('/owner/login', { replace: true })
        else nav('/owner/login', { replace: true })
      })
  }, [nav])

  const storeId = user?.storeIds[0] ?? ''
  const api = useMemo(() => ownerApi(storeId), [storeId])
  const refreshUnread = useCallback(() => {
    if (!storeId) return
    api
      .notifications()
      .then((n) => setUnread(n.unread))
      .catch(() => undefined)
  }, [api, storeId])

  useEffect(() => {
    refreshUnread()
    const t = window.setInterval(refreshUnread, 20_000)
    return () => window.clearInterval(t)
  }, [refreshUnread])

  if (!user) return <p role="status" className="grid min-h-dvh place-items-center bg-cream text-[1rem] text-charcoal/70">Checking your sign-in…</p>

  const storeName = demoStores.find((s) => s.id === storeId)?.name.en ?? storeId
  const ctx: OwnerCtx = { user, storeId, storeName, api, unread, refreshUnread }

  return (
    <OwnerContext.Provider value={ctx}>
      <div className="min-h-dvh bg-cream text-[1.0625rem] text-charcoal">
        <header className="border-b border-line bg-cream">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
            <Wordmark />
            <div className="min-w-0">
              <p className="eyebrow">Store owner</p>
              <p className="truncate font-display text-[1.15rem] leading-tight text-forest">{storeName}</p>
            </div>
            <div className="ml-auto flex items-center gap-3 text-[0.9rem]">
              <span className="hidden border border-terracotta/60 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-terracotta sm:inline">Demo</span>
              <span className="hidden text-charcoal/70 md:inline">{user.email}</span>
              <button
                type="button"
                onClick={() => authApi.logout().finally(() => nav('/owner/login', { replace: true }))}
                className="min-h-11 border border-forest/30 px-3 text-forest hover:bg-forest/10"
              >
                Sign out
              </button>
            </div>
          </div>
          <nav aria-label="Owner sections" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4">
            {NAV.map(([to, label, end]) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative inline-flex min-h-12 items-center whitespace-nowrap border-b-[3px] px-3 text-[1rem] font-medium ${isActive ? 'border-terracotta text-forest' : 'border-transparent text-charcoal/70 hover:text-forest'}`
                }
              >
                {label}
                {label === 'Alerts' && unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-terracotta px-1.5 text-[0.75rem] font-semibold text-white" aria-label={`${unread} unread`}>
                    {unread}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
          <Outlet />
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-[0.85rem] text-charcoal/60 sm:px-6">
          Demo store portal. <Link to="/" className="underline underline-offset-4">Open the shopping site</Link>
        </footer>
      </div>
    </OwnerContext.Provider>
  )
}
