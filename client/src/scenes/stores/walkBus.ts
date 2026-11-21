/**
 * Tiny bridge between the DOM controls (d-pad, minimap, department chips) and the 3D walk scene. Module-level
 * because only one store is ever open at a time.
 */
export type WalkCommand =
  | { type: 'product'; id: string }
  | { type: 'dept'; dept: string }
  | { type: 'entrance' }
  | { type: 'point'; x: number; z: number }

const subs = new Set<(c: WalkCommand) => void>()

export const walkCmd = {
  emit(c: WalkCommand) {
    subs.forEach((f) => f(c))
  },
  on(f: (c: WalkCommand) => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
}

/** Held-button input from the on-screen d-pad: -1..1 on each axis. */
export const walkInput = { fwd: 0, strafe: 0, turn: 0 }

/** Live camera state, written by the rig every frame and read by the minimap. */
export const walkPose = { x: 0, z: 0, yaw: 0, dept: null as string | null }
