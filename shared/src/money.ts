/** Money is stored as integer paise everywhere. Never use floats for currency. */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function formatPaise(paise: number): string {
  return inr.format(paise / 100)
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}
