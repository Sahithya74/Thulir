import { create } from 'zustand'
import type { StoreCategory } from '@thulir/shared'

export type TransitionPhase = 'idle' | 'covering' | 'covered' | 'revealing'

export interface TransitionTarget {
  slug: string
  name: string
  category: StoreCategory
}

interface TransitionState {
  phase: TransitionPhase
  target: TransitionTarget | null
  begin: (t: TransitionTarget) => void
  setPhase: (p: TransitionPhase) => void
  finish: () => void
}

export const useTransition = create<TransitionState>((set) => ({
  phase: 'idle',
  target: null,
  begin: (target) => set({ phase: 'covering', target }),
  setPhase: (phase) => set({ phase }),
  finish: () => set({ phase: 'idle', target: null }),
}))
