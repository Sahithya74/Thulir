import { isOpenAtMinute, istMinutes } from './dates.ts'
import type { SlotChoice, StoreHours } from './types.ts'

/** The earliest a scheduled slot may start, measured from now. Stores need time to pack. */
export const MIN_SLOT_LEAD_MIN = 60
/** The last hour a delivery window may start. */
export const LAST_SLOT_START_HOUR = 20

/**
 * Hourly delivery windows today (IST), each of which every store in the basket is open for from start to end.
 * "As soon as possible" is always available separately. The server runs this same function to validate a choice.
 */
export function availableSlotStarts(storeHours: StoreHours[], now: Date = new Date()): number[] {
  const earliest = Math.ceil((istMinutes(now) + MIN_SLOT_LEAD_MIN) / 60)
  const out: number[] = []
  for (let h = earliest; h <= LAST_SLOT_START_HOUR; h++) {
    const start = h * 60
    const end = h * 60 + 59
    if (storeHours.every((s) => isOpenAtMinute(s, start) && isOpenAtMinute(s, end))) out.push(h)
  }
  return out
}

export function isSlotAllowed(slot: SlotChoice, storeHours: StoreHours[], now: Date = new Date()): boolean {
  if (slot.kind === 'asap') return true
  return Number.isInteger(slot.startHour) && availableSlotStarts(storeHours, now).includes(slot.startHour)
}

const pad = (n: number) => String(n).padStart(2, '0')

export function slotLabel(slot: SlotChoice): string {
  return slot.kind === 'asap' ? 'As soon as possible' : `Today ${pad(slot.startHour)}:00–${pad(slot.startHour + 1)}:00`
}
