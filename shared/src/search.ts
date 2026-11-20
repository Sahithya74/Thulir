import type { Department, Localised, Product } from './types.ts'

/**
 * Search architecture notes
 * - Matching is language-agnostic: every product carries `name.en`, `name.ta` and `aliases` (Tamil written in Latin
 *   letters, e.g. "arisi"), and all of them are searched whatever the UI language is.
 * - Adding real Tamil transliteration later means adding aliases (or a transliterator) — no search code changes.
 */

/** Case-fold and strip Latin diacritics. Tamil letters (and their vowel signs) are left intact. */
export function normalise(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // apostrophes vanish ("Lay's" → "lays"); other punctuation separates words
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const DEPARTMENT_LABEL: Record<Department, Localised> = {
  fresh: { en: 'Fresh', ta: 'புதியவை' },
  pantry: { en: 'Pantry', ta: 'மளிகை' },
  chilled: { en: 'Chilled', ta: 'குளிர்பதனம்' },
  household: { en: 'Household', ta: 'வீட்டு உபயோகம்' },
  personal_care: { en: 'Personal care', ta: 'தனிநபர் பராமரிப்பு' },
  snacks: { en: 'Snacks', ta: 'சிற்றுண்டிகள்' },
  beverages: { en: 'Beverages', ta: 'பானங்கள்' },
  bakery: { en: 'Bakery', ta: 'பேக்கரி' },
}

/** Everyday words people type for a department. */
export const DEPARTMENT_KEYWORDS: Record<Department, string[]> = {
  fresh: ['fresh', 'vegetable', 'vegetables', 'veg', 'fruit', 'fruits', 'produce', 'காய்கறி', 'பழம்'],
  pantry: ['pantry', 'grocery', 'groceries', 'staples', 'provisions', 'மளிகை'],
  chilled: ['chilled', 'dairy', 'milk products', 'குளிர்பதனம்'],
  household: ['household', 'cleaning', 'home care'],
  personal_care: ['personal care', 'personal', 'hygiene', 'bath'],
  snacks: ['snacks', 'snack', 'biscuits', 'munchies'],
  beverages: ['beverages', 'drinks', 'drink', 'juice'],
  bakery: ['bakery', 'bread', 'cakes', 'பேக்கரி'],
}

export const POPULAR_SEARCHES = ['rice', 'toor dal', 'milk', 'bread', 'tomato', 'sambar powder', 'eggs', 'sesame oil'] as const

interface Field {
  text: string
  weight: number
}

/** The slice of a product that search needs — satisfied by both `Product` and the customer-facing `ProductView`. */
export type Searchable = Pick<Product, 'name' | 'brand' | 'aliases' | 'tags' | 'department'>

function fieldsOf(p: Searchable, storeName?: Localised): Field[] {
  const f: Field[] = [
    { text: normalise(p.name.en), weight: 10 },
    { text: normalise(p.name.ta), weight: 10 },
    { text: normalise(p.brand), weight: 6 },
    ...p.aliases.map((a) => ({ text: normalise(a), weight: 8 })),
    ...p.tags.map((t) => ({ text: normalise(t), weight: 3 })),
    { text: normalise(DEPARTMENT_LABEL[p.department].en), weight: 2 },
    { text: normalise(DEPARTMENT_KEYWORDS[p.department].join(' ')), weight: 2 },
  ]
  if (storeName) f.push({ text: normalise(`${storeName.en} ${storeName.ta}`), weight: 1 })
  return f
}

/**
 * Score a product for a query. Every query token must match something (AND); partial words match.
 * Returns 0 for no match.
 */
export function scoreProduct(p: Searchable, query: string, storeName?: Localised): number {
  const tokens = normalise(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return 0
  const fields = fieldsOf(p, storeName)
  let total = 0
  for (const tok of tokens) {
    let best = 0
    for (const f of fields) {
      if (!f.text) continue
      let m = 0
      if (f.text === tok) m = 1.4
      else if (f.text.startsWith(tok)) m = 1.1
      else if (f.text.split(' ').some((w) => w.startsWith(tok))) m = 1
      else if (tok.length >= 3 && f.text.includes(tok)) m = 0.55
      best = Math.max(best, m * f.weight)
    }
    if (best === 0) return 0
    total += best
  }
  return total
}

/** Departments whose everyday keywords match the query ("vegetables" → fresh). */
export function matchDepartments(query: string): Department[] {
  const q = normalise(query)
  if (q.length < 2) return []
  const out: Department[] = []
  for (const d of Object.keys(DEPARTMENT_KEYWORDS) as Department[]) {
    const words = [normalise(DEPARTMENT_LABEL[d].en), normalise(DEPARTMENT_LABEL[d].ta), ...DEPARTMENT_KEYWORDS[d].map(normalise)]
    if (words.some((w) => w.startsWith(q))) out.push(d)
  }
  return out
}
