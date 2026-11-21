import { useEffect, useMemo, useRef } from 'react'
import { DEPARTMENT_LABEL, type Department, type ProductView } from '@thulir/shared'
import { ProductCard, type CardVariant } from '@/components/products/ProductCard'
import { pick, useLang } from '@/services/i18n'
import { gsap, revealOnScroll } from '@/services/motion'

interface Props {
  products: ProductView[]
  departments: { id: Department; count: number }[]
  /** Group under a big heading per department (only when nothing narrows the list). */
  sectioned: boolean
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

/** Size each product in a section: the best offer becomes a 2x2 feature, and now and then a tile goes wide. */
function layout(items: ProductView[]): { p: ProductView; variant: CardVariant }[] {
  const list = [...items]
  if (list.length >= 5) {
    let best = 0
    list.forEach((p, i) => {
      if (p.discountPercent > list[best].discountPercent) best = i
    })
    const [top] = list.splice(best, 1)
    list.unshift(top)
  }
  return list.map((p, i) => ({
    p,
    variant: list.length >= 5 && i === 0 ? 'feature' : list.length >= 9 && i % 7 === 4 ? 'wide' : 'tile',
  }))
}

const SPAN: Record<CardVariant, string> = {
  tile: '',
  feature: 'col-span-2 row-span-2',
  wide: 'col-span-2',
}

export function BentoGrid({ products, departments, sectioned, selectedId, hoveredId, onSelect, onHover }: Props) {
  const lang = useLang()
  const root = useRef<HTMLDivElement>(null)

  const sections = useMemo(() => {
    if (!sectioned) return [{ id: 'all', items: layout(products) }]
    const by = new Map<Department, ProductView[]>()
    products.forEach((p) => by.set(p.department, [...(by.get(p.department) ?? []), p]))
    return departments.filter((d) => by.has(d.id)).map((d) => ({ id: d.id as string, items: layout(by.get(d.id)!) }))
  }, [products, departments, sectioned])

  // Tiles rise into place as they scroll into view; ones already shown are left alone.
  const key = products.map((p) => p.id).join('|')
  useEffect(() => {
    const ctx = gsap.context(() => revealOnScroll(root.current), root)
    return () => ctx.revert()
  }, [key])

  return (
    <div ref={root} className="mt-4 space-y-10">
      {sections.map((sec) => (
        <section key={sec.id} aria-label={sec.id === 'all' ? undefined : pick(DEPARTMENT_LABEL[sec.id as Department], lang)}>
          {sec.id !== 'all' && (
            <div data-reveal className="mb-4 flex items-end justify-between gap-4 border-b border-forest/10 pb-2">
              <h2 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] leading-none text-forest">{pick(DEPARTMENT_LABEL[sec.id as Department], lang)}</h2>
              <span className="text-[0.8rem] text-charcoal/60">{sec.items.length}</span>
            </div>
          )}
          <ul className="grid grid-flow-dense grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 [perspective:1400px]">
            {sec.items.map(({ p, variant }) => (
              <li key={p.id} data-reveal="scale" className={SPAN[variant]}>
                <ProductCard product={p} variant={variant} selected={selectedId === p.id} hovered={hoveredId === p.id} onSelect={onSelect} onHover={onHover} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
