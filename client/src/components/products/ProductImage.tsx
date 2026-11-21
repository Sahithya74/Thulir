import { ProductArt } from './ProductArt'
import type { PackSource } from './packDesign'

interface Props {
  product: PackSource & { imageUrl?: string | null }
  className?: string
  /** Give it an accessible name (when the product name is not already next to it). */
  labelled?: boolean
  size?: number
}

/** The store's own photo when there is one; otherwise the generated pack picture. */
export function ProductImage({ product: p, className, labelled = false, size }: Props) {
  if (p.imageUrl) {
    return <img src={p.imageUrl} alt={labelled ? p.name.en : ''} loading="lazy" decoding="async" className={`${className ?? ''} object-contain`} />
  }
  return <ProductArt product={p} label={labelled ? p.name.en : undefined} className={className} size={size} />
}
