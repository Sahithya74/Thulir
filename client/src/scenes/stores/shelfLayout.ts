export interface Slot {
  x: number
  /** Height of the shelf surface this pack stands on. */
  y: number
  level: number
}

export const SHELF_WIDTH = 12
const ROW_GAP = 1.75

export function levelsFor(n: number): number {
  return n <= 7 ? 1 : n <= 14 ? 2 : 3
}

/** Y of the shelf surface for a row; row 0 is the top row so the first products read first. */
export function shelfY(level: number, levels: number): number {
  return (levels - 1 - level) * ROW_GAP + 0.9
}

/** Position of every pack on the shelf unit. Rows are centred; spacing tightens as a row fills. */
export function layoutShelf(n: number): { slots: Slot[]; levels: number; width: number } {
  const levels = levelsFor(n)
  const perRow = Math.max(1, Math.ceil(n / levels))
  const spacing = Math.min(1.9, SHELF_WIDTH / perRow)
  const slots: Slot[] = []
  for (let i = 0; i < n; i++) {
    const level = Math.floor(i / perRow)
    const idx = i % perRow
    const count = Math.min(perRow, n - level * perRow)
    slots.push({ x: (idx - (count - 1) / 2) * spacing, y: shelfY(level, levels), level })
  }
  // The unit hugs its contents: no empty acres of shelf around a handful of packs.
  const width = Math.min(SHELF_WIDTH + 1, Math.max(6.5, (Math.min(perRow, n) - 1) * spacing + 2.6))
  return { slots, levels, width }
}

/** Relative pack size from its printed unit, so a 25 kg sack looks bigger than a 100 g sachet. */
export function packScale(unit: string): number {
  const m = unit.toLowerCase().match(/([\d.]+)\s*(kg|g|litre|l|ml|piece|pieces|pack|bunch)/)
  if (!m) return 0.85
  const n = parseFloat(m[1])
  switch (m[2]) {
    case 'kg':
      return n >= 5 ? 1.25 : 1.05
    case 'litre':
    case 'l':
      return 1.05
    case 'g':
      return n >= 500 ? 0.95 : n >= 200 ? 0.8 : 0.66
    case 'ml':
      return n >= 500 ? 0.95 : n >= 200 ? 0.75 : 0.62
    default:
      return 0.75
  }
}
