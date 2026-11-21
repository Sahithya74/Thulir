import { useEffect, useState } from 'react'
import { loadPackFonts, packFontsReady, packImageUrl } from './packArt'
import type { PackSource } from './packDesign'

interface Props {
  product: PackSource
  /** Accessible name. Omit when the product name is already rendered next to the art. */
  label?: string
  className?: string
  /** Drawing size in CSS pixels (the image is rendered at device resolution). */
  size?: number
}

function usePackFonts(): boolean {
  const [ready, setReady] = useState(packFontsReady)
  useEffect(() => {
    if (ready) return
    let live = true
    void loadPackFonts().then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [ready])
  return ready
}

/**
 * A generated retail-pack picture: pack shape, printed front, light and shadow, drawn from the product's details.
 * These are illustrations, not photographs, and copy no brand artwork — real photos arrive through the owner portal.
 */
export function ProductArt({ product, label, className, size = 320 }: Props) {
  const fonts = usePackFonts()
  const [src, setSrc] = useState(() => (fonts ? packImageUrl(product, size) : ''))
  useEffect(() => {
    setSrc(packImageUrl(product, size))
  }, [product, size, fonts])
  if (!src) return <span aria-hidden className={`${className ?? ''} inline-block animate-pulse rounded bg-limestone/70`} />
  return (
    <img
      src={src}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      decoding="async"
      className={`${className ?? ''} object-contain`}
    />
  )
}
