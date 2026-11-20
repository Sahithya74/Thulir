/**
 * Indian mobile numbers: 10 digits starting 6–9. Accepts the ways people actually type them
 * ("98765 43210", "+91 98765-43210", "098765 43210") and returns the canonical 10 digits, or null if it is not one.
 */
export function normaliseIndianMobile(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '')
  if (d.startsWith('+91')) d = d.slice(3)
  else if (d.startsWith('0091')) d = d.slice(4)
  else if (d.startsWith('91') && d.length === 12) d = d.slice(2)
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? d : null
}

/** "98765 43210" — for display only. */
export function formatMobile(ten: string): string {
  return ten.length === 10 ? `+91 ${ten.slice(0, 5)} ${ten.slice(5)}` : ten
}
