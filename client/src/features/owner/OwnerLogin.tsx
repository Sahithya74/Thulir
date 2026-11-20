import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wordmark } from '@/components/navigation/TopBar'
import { authApi } from '@/services/ownerApi'
import { Btn, ErrorNote, Field, errorText, inputClass } from './ownerUi'

/**
 * DEMO ACCOUNTS are listed on purpose so the prototype can be tried. A real deployment would not have them.
 * The password shown here is the published demo password, not a secret.
 */
const DEMO_PASSWORD = 'Thulir-Demo-2026!'
const DEMO_OWNERS = [
  ['Marutham Super Mart', 'owner.marutham@demo.thulir.test'],
  ['Selvam Provision Stores', 'owner.selvam@demo.thulir.test'],
  ['Pasumai Fruits & Vegetables', 'owner.pasumai@demo.thulir.test'],
  ['Madhuram Bakery', 'owner.madhuram@demo.thulir.test'],
  ['Thenral Dairy', 'owner.thenral@demo.thulir.test'],
  ['Illam Household Needs', 'owner.illam@demo.thulir.test'],
] as const

export default function OwnerLogin() {
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
      if (u.role !== 'store_owner') {
        await authApi.logout().catch(() => undefined)
        setErr('This account is not a store owner account.')
        setBusy(false)
        return
      }
      nav('/owner', { replace: true })
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
          <p className="eyebrow">For store owners</p>
          <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3rem)] leading-[1.05] text-forest">Sign in to your store</h1>
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
            Demo accounts
          </h2>
          <p className="mt-1 text-[0.95rem] text-charcoal/80">
            These fictional stores exist only for this prototype. Every demo account uses the password{' '}
            <code className="bg-limestone px-1.5 py-0.5 font-mono text-[0.9rem]">{DEMO_PASSWORD}</code>.
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {DEMO_OWNERS.map(([store, mail]) => (
              <li key={mail}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(mail)
                    setPassword(DEMO_PASSWORD)
                  }}
                  className="flex min-h-12 w-full flex-col items-start justify-center py-2 text-left hover:bg-limestone/60"
                >
                  <span className="font-medium text-forest">{store}</span>
                  <span className="text-[0.85rem] text-charcoal/65">{mail}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.85rem] text-charcoal/70">Choose a store to fill in its details, then press Sign in.</p>
        </aside>
      </main>
    </div>
  )
}
