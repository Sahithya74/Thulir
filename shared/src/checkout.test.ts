import { describe, expect, it } from 'vitest'
import { availableSlotStarts, formatMobile, isSlotAllowed, normaliseIndianMobile, slotLabel } from './index.ts'

describe('Indian mobile numbers', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['98765 43210', '9876543210'],
    ['+91 98765-43210', '9876543210'],
    ['+919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    ['919876543210', '9876543210'],
    ['(98765) 43210', '9876543210'],
    ['6000000000', '6000000000'],
  ])('accepts %s', (input, out) => expect(normaliseIndianMobile(input)).toBe(out))

  it.each(['', '12345', '5876543210', '98765432', '98765432101', 'abcdefghij', '+1 9876543210', '0000000000', '98765 4321a'])(
    'rejects %j',
    (input) => expect(normaliseIndianMobile(input)).toBeNull(),
  )
  it('formats for display', () => expect(formatMobile('9876543210')).toBe('+91 98765 43210'))
})

describe('delivery slots', () => {
  const hours = [{ opens: '07:00', closes: '22:00' }]
  const at = (ist: string) => new Date(`2026-06-10T${ist}:00+05:30`)

  it('starts at least an hour ahead, on the hour', () => {
    expect(availableSlotStarts(hours, at('12:10'))[0]).toBe(14) // 12:10 + 60 = 13:10 → next whole hour 14
    expect(availableSlotStarts(hours, at('12:00'))[0]).toBe(13)
  })
  it('stops at the last allowed start hour', () => {
    expect(availableSlotStarts(hours, at('09:00')).at(-1)).toBe(20)
  })
  it('is empty late in the evening', () => {
    expect(availableSlotStarts(hours, at('20:30'))).toEqual([])
  })
  it('every store in the basket must be open for the whole window', () => {
    const dairyMorning = { opens: '05:00', closes: '13:00' } // closes at 13:00
    const slots = availableSlotStarts([...hours, dairyMorning], at('08:00'))
    expect(slots).toContain(11)
    expect(slots).toContain(12) // 12:00–12:59 is within 05:00–13:00
    expect(slots).not.toContain(13) // 13:00–13:59 is after the dairy closes
  })
  it('ASAP is always allowed; windows only when offered', () => {
    expect(isSlotAllowed({ kind: 'asap' }, hours, at('23:00'))).toBe(true)
    expect(isSlotAllowed({ kind: 'window', startHour: 14 }, hours, at('12:10'))).toBe(true)
    expect(isSlotAllowed({ kind: 'window', startHour: 13 }, hours, at('12:10'))).toBe(false)
    expect(isSlotAllowed({ kind: 'window', startHour: 14.5 }, hours, at('12:10'))).toBe(false)
    expect(isSlotAllowed({ kind: 'window', startHour: 3 }, hours, at('12:10'))).toBe(false)
  })
  it('labels', () => {
    expect(slotLabel({ kind: 'asap' })).toBe('As soon as possible')
    expect(slotLabel({ kind: 'window', startHour: 9 })).toBe('Today 09:00–10:00')
  })
})
