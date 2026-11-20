export type CameraCommand = 'zoomIn' | 'zoomOut' | 'reset' | 'explore' | 'enter'

type Listener = (cmd: CameraCommand, arg?: string) => void
const listeners = new Set<Listener>()

/** Tiny imperative bridge so HTML controls (outside the Canvas) can drive the camera rig. */
export const cameraBus = {
  emit(cmd: CameraCommand, arg?: string) {
    listeners.forEach((l) => l(cmd, arg))
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}
