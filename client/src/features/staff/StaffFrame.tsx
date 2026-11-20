import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { SessionUser, UserRole } from '@thulir/shared'
import { Wordmark } from '@/components/navigation/TopBar'
import { authApi } from '@/services/ownerApi'
import { Btn, ErrorNote, Field, errorText, inputClass } from '@/features/owner/ownerUi'

const DEMO_PASSWORD = 'Thulir-Demo-2026!'

interface PortalInfo {
  role: Exclude<UserRole, 'customer' | 'store_owner'>
  base: string
  title: string
  eyebrow: string
  demoEmail: string
  demoName: string
}

export const DELIVERY_PORTAL: PortalInfo = {
  role: 'delivery_partner',
  base: '/delivery',
  title: 'Sign in to deliver',
  eyebrow: 'For delivery partners',
  demoEmail: 'partner@demo.thulir.test',
  demoName: 'Ravi Kumar (demo partner)',
}

export const ADMIN_PORTAL: PortalInfo = {
  role: 'admin',
  base: '/admin',
  title: 'Platform admin',
  eyebrow: 'For Thulir staff',
  demoEmail: 'admin@demo.thulir.test',
  demoName: 'Demo platform admin',
}

/** Sign-in page shared by the delivery and admin portals. The demo account is listed on purpose. */
export function StaffLogin({ portal }: { portal: PortalInfo }) {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const u = await authApi.login(email, password)
      if (u.role !== portal.role) {
        await authApi.logout().catch(() => undefined)
        setErr(`This account cannot use the ${portal.role === 'admin' ? 'admin' : 'delivery'} portal.`)
        setBusy(false)
        return
      }
      nav(portal.base, { replace: true })
    } catch (x) {
      setErr(errorText(x))
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-cream text-[1.0625rem]">
      <header className="flex h-16 items-center justify-between border-b border-line px-5 sm:px-8">
        <Wordmark />
        <Link to="/" className="text-[0.95rem] text-forest underline underline-offset-4">
          Shopping site
        </Link>
      </header>
      <main className="mx-auto grid max-w-5xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_1fr]">
        <section>
          <p className="eyebrow">{portal.eyebrow}</p>
          <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3rem)] leading-[1.05] text-forest">{portal.title}</h1>
          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            <Field label="Email">
              <input className={inputClass} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <ErrorNote error={err} />
            <Btn type="submit" disabled={busy || !email || !password} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Btn>
          </form>
        </section>
        <aside aria-labelledby="demo-title" className="border-2 border-dashed border-terracotta bg-white p-5">
          <h2 id="demo-title" className="font-display text-[1.3rem] text-terracotta">
            Demo account
          </h2>
          <p className="mt-1 text-[0.95rem] text-charcoal/80">
            A fictional account for trying the prototype. Password{' '}
            <code className="bg-limestone px-1.5 py-0.5 font-mono text-[0.9rem]">{DEMO_PASSWORD}</code>.
          </p>
          <button
            type="button"
            onClick={() => {
              setEmail(portal.demoEmail)
              setPassword(DEMO_PASSWORD)
            }}
            className="mt-4 flex min-h-12 w-full flex-col items-start justify-center border-y border-line py-2 text-left hover:bg-limestone/60"
          >
            <span className="font-medium text-forest">{portal.demoName}</span>
            <span className="text-[0.85rem] text-charcoal/65">{portal.demoEmail}</span>
          </button>
          <p className="mt-3 text-[0.85rem] text-charcoal/70">Choose it to fill in the details, then press Sign in.</p>
        </aside>
      </main>
    </div>
  )
}

/**
 * Guard + frame for a staff portal. The browser only decides what to SHOW; the server checks the role and the CSRF
 * token on every request regardless.
 */
export function StaffFrame({ portal, nav: links }: { portal: PortalInfo; nav?: readonly (readonly [string, string, boolean])[] }) {
  const nav = useNavigate()
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    authApi
      .me()
      .then((u) => (u.role === portal.role ? setUser(u) : nav(`${portal.base}/login`, { replace: true })))
      .catch(() => nav(`${portal.base}/login`, { replace: true }))
  }, [nav, portal])

  if (!user) return <p role="status" className="grid min-h-dvh place-items-center bg-cream text-[1rem] text-charcoal/70">Checking your sign-in…</p>

  return (
    <div className="min-h-dvh bg-cream text-[1.0625rem] text-charcoal">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Wordmark />
          <div className="min-w-0">
            <p className="eyebrow">{portal.role === 'admin' ? 'Platform admin' : 'Delivery partner'}</p>
            <p className="truncate font-display text-[1.15rem] leading-tight text-forest">{user.name}</p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-[0.9rem]">
            <span className="border border-terracotta/60 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-terracotta">Demo</span>
            <button
              type="button"
              onClick={() => authApi.logout().finally(() => nav(`${portal.base}/login`, { replace: true }))}
              className="min-h-11 border border-forest/30 px-3 text-forest hover:bg-forest/10"
            >
              Sign out
            </button>
          </div>
        </div>
        {links && (
          <nav aria-label="Sections" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4">
            {links.map(([to, label, end]) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex min-h-12 items-center whitespace-nowrap border-b-[3px] px-3 text-[1rem] font-medium ${isActive ? 'border-terracotta text-forest' : 'border-transparent text-charcoal/70 hover:text-forest'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-[0.85rem] text-charcoal/60 sm:px-6">
        Demo portal — all data is fictional. <Link to="/" className="underline underline-offset-4">Open the shopping site</Link>
      </footer>
    </div>
  )
}
