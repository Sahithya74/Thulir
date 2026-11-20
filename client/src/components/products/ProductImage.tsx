import type { PackShape } from '@thulir/shared'
import { ProductArt } from './ProductArt'

interface Props {
  product: { shape: PackShape; color: string; brand: string; imageUrl?: string | null; name: { en: string } }
  className?: string
  /** Give it an accessible name (when the product name is not already next to it). */
  labelled?: boolean
}

/** The store's own photo when there is one; otherwise the generated pack illustration. */
export function ProductImage({ product: p, className, labelled = false }: Props) {
  if (p.imageUrl) {
    return <img src={p.imageUrl} alt={labelled ? p.name.en : ''} loading="lazy" decoding="async" className={`${className ?? ''} object-contain`} />
  }
  return <ProductArt shape={p.shape} color={p.color} brand={p.brand} label={labelled ? p.name.en : undefined} className={className} />
}
