export interface PinPos {
  /** CSS px relative to the canvas element */
  x: number
  y: number
  /** NDC depth, used to stack nearer pins above farther ones */
  depth: number
  visible: boolean
}

/** Written every frame by the in-canvas PinProjector, read by the DOM PinOverlay. Mutable on purpose: no React churn. */
export const pinPositions = new Map<string, PinPos>()
