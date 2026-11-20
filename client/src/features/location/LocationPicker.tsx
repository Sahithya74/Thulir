import { useEffect, useMemo, useRef, useState } from 'react'
import {
  checkPincode,
  locationFromAddress,
  locationFromArea,
  resolveDetectedPosition,
  type AddressLabel,
  type PincodeCheck,
} from '@thulir/shared'
import { LanguageSwitch } from '@/components/navigation/TopBar'
import { api } from '@/services/api'
import { pick, useLang, useT, type DictKey } from '@/services/i18n'
import { useLocation } from '@/store/location'
import { DetectFailure, detectPosition } from './detect'

type DetectState = 'idle' | 'loading' | 'denied' | 'unavailable' | { outsideKm: number } | 'ok'

const LABELS: { id: AddressLabel; key: DictKey }[] = [
  { id: 'home', key: 'addrHome' },
  { id: 'work', key: 'addrWork' },
  { id: 'other', key: 'addrOther' },
]

const norm = (s: string) => s.normalize('NFKD').toLowerCase().trim()

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4 sm:px-6">
      <h3 className="eyebrow">{title}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

export function LocationPicker() {
  const t = useT()
  const lang = useLang()
  const dialog = useRef<HTMLDialogElement>(null)
  const open = useLocation((s) => s.pickerOpen)
  const close = useLocation((s) => s.closePicker)
  const towns = useLocation((s) => s.towns)
  const current = useLocation((s) => s.location)
  const setLocation = useLocation((s) => s.setLocation)
  const addresses = useLocation((s) => s.addresses)
  const saveAddress = useLocation((s) => s.saveAddress)
  const removeAddress = useLocation((s) => s.removeAddress)

  const [detect, setDetect] = useState<DetectState>('idle')
  const [query, setQuery] = useState('')
  const [line1, setLine1] = useState('')
  const [areaId, setAreaId] = useState('')
  const [pincode, setPincode] = useState('')
  const [label, setLabel] = useState<AddressLabel>('home')
  const [errors, setErrors] = useState<{ line1?: DictKey; pincode?: DictKey }>({})
  const [checking, setChecking] = useState(false)

  // Native <dialog> gives us focus trapping, Esc handling and inertness of the page behind it.
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const allAreas = useMemo(() => towns.flatMap((tn) => tn.areas.map((a) => ({ area: a, town: tn }))), [towns])
  const matching = useMemo(() => {
    const q = norm(query)
    if (!q) return allAreas
    return allAreas.filter(({ area }) => norm(area.name.en).includes(q) || norm(area.name.ta).includes(q))
  }, [allAreas, query])

  useEffect(() => {
    if (!areaId && allAreas[0]) setAreaId(allAreas[0].area.id)
  }, [allAreas, areaId])

  const onDetect = async () => {
    setDetect('loading')
    try {
      const pos = await detectPosition()
      const res = resolveDetectedPosition(towns, pos)
      if (!res.ok) {
        setDetect({ outsideKm: Math.round(res.distanceM / 1000) })
        return
      }
      setDetect('ok')
      setLocation(res.location)
    } catch (e) {
      setDetect(e instanceof DetectFailure ? e.kind : 'unavailable')
    }
  }

  const onSubmitAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    const entry = allAreas.find((x) => x.area.id === areaId)
    if (!entry) return
    const next: typeof errors = {}
    const text = line1.trim()
    if (text.length < 3) next.line1 = 'lineRequired'
    const pin = pincode.trim()
    // Cheap format check locally, then ask the server — it is the authority on serviceability.
    let result: PincodeCheck = checkPincode(entry.town, pin)
    if (result !== 'invalid_format') {
      setChecking(true)
      try {
        result = (await api.pincode(entry.town.id, pin)).result
      } catch {
        /* API offline: keep the local answer */
      } finally {
        setChecking(false)
      }
    }
    if (result === 'invalid_format') next.pincode = 'pincodeInvalid'
    else if (result === 'not_serviceable') next.pincode = 'pincodeNotServiceable'
    setErrors(next)
    if (next.line1 || next.pincode) return

    const saved = saveAddress({ label, line1: text, areaId: entry.area.id, townId: entry.town.id, pincode: pin })
    const loc = locationFromAddress(saved, towns)
    if (loc) setLocation(loc)
    setLine1('')
    setPincode('')
  }

  const detectMessage = (() => {
    if (detect === 'denied') return t('detectDenied')
    if (detect === 'unavailable') return t('detectUnavailable')
    if (typeof detect === 'object') return t('detectOutside', { km: detect.outsideKm })
    return null
  })()

  return (
    <dialog
      ref={dialog}
      aria-labelledby="loc-title"
      onClose={close}
      onClick={(e) => e.target === dialog.current && close()}
      className="m-auto max-h-[92dvh] w-[min(560px,94vw)] overflow-y-auto border border-line bg-cream p-0 text-charcoal shadow-[0_40px_90px_-30px_rgba(32,37,34,0.7)] backdrop:bg-forest/60"
    >
      <div className="flex justify-end px-5 pt-4 sm:px-6">
        <LanguageSwitch />
      </div>
      <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-3 sm:px-6">
        <div>
          <h2 id="loc-title" className="font-display text-[1.6rem] leading-tight text-forest">
            {t('locTitle')}
          </h2>
          <p className="mt-1.5 text-[0.85rem] text-charcoal/75">{t('locIntro')}</p>
        </div>
        <button type="button" onClick={close} aria-label={t('close')} className="tap -mr-2 -mt-1 px-2 text-xl text-forest/70 hover:text-forest">
          ×
        </button>
      </div>

      <Section title={t('detect')}>
        <button
          type="button"
          onClick={onDetect}
          disabled={detect === 'loading'}
          className="tap w-full border border-forest bg-forest px-4 text-[0.9rem] font-medium text-cream hover:bg-charcoal disabled:opacity-60"
        >
          {detect === 'loading' ? t('detecting') : t('detect')}
        </button>
        {detectMessage && (
          <p role="alert" className="mt-2 border-l-2 border-terracotta bg-terracotta/10 px-2.5 py-1.5 text-[0.82rem]">
            {detectMessage}
          </p>
        )}
        {detect === 'ok' && <p className="mt-2 text-[0.82rem] text-olive">{t('detectedNote')}</p>}
      </Section>

      {addresses.length > 0 && (
        <Section title={t('savedAddresses')}>
          <ul className="divide-y divide-line border border-line">
            {addresses.map((a) => {
              const loc = locationFromAddress(a, towns)
              if (!loc) return null
              const active = current?.addressId === a.id
              const labelKey = LABELS.find((l) => l.id === a.label)!.key
              return (
                <li key={a.id} className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => setLocation(loc)}
                    aria-pressed={active}
                    className={`tap min-w-0 flex-1 px-3 py-2 text-left text-[0.85rem] ${active ? 'bg-forest text-cream' : 'hover:bg-limestone'}`}
                  >
                    <span className="eyebrow block !text-inherit opacity-75">{t(labelKey)}</span>
                    <span className="block truncate">{pick(loc.label, lang)}</span>
                    <span className="block text-[0.75rem] opacity-70">{a.pincode}</span>
                  </button>
                  <button type="button" onClick={() => removeAddress(a.id)} aria-label={`${t('remove')}: ${a.line1}`} className="tap px-3 text-[0.78rem] text-terracotta hover:bg-limestone">
                    {t('remove')}
                  </button>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      <Section title={t('searchArea')}>
        <label className="sr-only" htmlFor="area-search">
          {t('searchArea')}
        </label>
        <input
          id="area-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchArea')}
          autoComplete="off"
          className="tap w-full border border-forest/30 bg-white px-3 text-[0.9rem] outline-none focus:border-forest"
        />
        <ul className="mt-2 max-h-44 overflow-y-auto border border-line">
          {matching.map(({ area, town }) => {
            const active = current?.areaId === area.id && current.source === 'area'
            return (
              <li key={area.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => setLocation(locationFromArea(area))}
                  aria-pressed={active}
                  className={`tap flex w-full items-baseline justify-between gap-3 px-3 text-left text-[0.9rem] ${active ? 'bg-forest text-cream' : 'hover:bg-limestone'}`}
                >
                  <span>{pick(area.name, lang)}</span>
                  <span className="text-[0.72rem] opacity-65">{pick(town.name, lang)}</span>
                </button>
              </li>
            )
          })}
          {matching.length === 0 && <li className="px-3 py-3 text-[0.85rem] text-charcoal/70">{t('noAreas')}</li>}
        </ul>
      </Section>

      <Section title={t('enterAddress')}>
        <form onSubmit={onSubmitAddress} noValidate className="grid gap-3">
          <div>
            <label htmlFor="addr-line" className="text-[0.78rem] font-medium">
              {t('addrLine')}
            </label>
            <input
              id="addr-line"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              maxLength={80}
              autoComplete="address-line1"
              aria-invalid={Boolean(errors.line1)}
              aria-describedby={errors.line1 ? 'addr-line-err' : undefined}
              className="tap mt-1 w-full border border-forest/30 bg-white px-3 text-[0.9rem] outline-none focus:border-forest"
            />
            {errors.line1 && (
              <p id="addr-line-err" className="mt-1 text-[0.78rem] text-terracotta">
                {t(errors.line1)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="addr-area" className="text-[0.78rem] font-medium">
                {t('addrArea')}
              </label>
              <select
                id="addr-area"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="tap mt-1 w-full border border-forest/30 bg-white px-2 text-[0.9rem] outline-none focus:border-forest"
              >
                {allAreas.map(({ area }) => (
                  <option key={area.id} value={area.id}>
                    {pick(area.name, lang)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="addr-pin" className="text-[0.78rem] font-medium">
                {t('addrPincode')}
              </label>
              <input
                id="addr-pin"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="postal-code"
                aria-invalid={Boolean(errors.pincode)}
                aria-describedby={errors.pincode ? 'addr-pin-err' : undefined}
                className="tap mt-1 w-full border border-forest/30 bg-white px-3 text-[0.9rem] tabular-nums outline-none focus:border-forest"
              />
            </div>
          </div>
          {errors.pincode && (
            <p id="addr-pin-err" role="alert" className="-mt-1 text-[0.78rem] text-terracotta">
              {t(errors.pincode)}
            </p>
          )}
          <fieldset>
            <legend className="text-[0.78rem] font-medium">{t('addrLabel')}</legend>
            <div className="mt-1 flex gap-1.5">
              {LABELS.map((l) => (
                <label key={l.id} className={`tap flex cursor-pointer items-center border px-3 text-[0.82rem] ${label === l.id ? 'border-forest bg-forest text-cream' : 'border-forest/30'}`}>
                  <input type="radio" name="addr-label" value={l.id} checked={label === l.id} onChange={() => setLabel(l.id)} className="sr-only" />
                  {t(l.key)}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" disabled={checking} className="tap border border-forest bg-forest px-4 text-[0.9rem] font-medium text-cream hover:bg-charcoal disabled:opacity-60">
            {t('saveAddress')}
          </button>
        </form>
      </Section>
    </dialog>
  )
}
