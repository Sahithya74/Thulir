import type { StoreCategory } from '@thulir/shared'

export type Fixture = 'aisle' | 'pantry' | 'market' | 'counter' | 'chilled' | 'rack'

/**
 * One reusable walk-in store, six personalities. A theme is configuration only — colours, light and which fixture
 * style the shelving takes — so adding a store type never means writing a new scene.
 */
export interface StoreTheme {
  fixture: Fixture
  floor: string
  /** Second floor tone (tile checker / plank contrast). */
  floorB: string
  wall: string
  shelf: string
  trim: string
  accent: string
  sky: string
  /** Colour and strength of the key light. */
  light: string
  lightI: number
  hemiI: number
}

export const STORE_THEMES: Record<StoreCategory, StoreTheme> = {
  supermarket: { fixture: 'aisle', floor: '#e9eff5', floorB: '#d2dce8', wall: '#f7fafd', shelf: '#cdd7e2', trim: '#0f2a43', accent: '#0b8079', sky: '#dcecf8', light: '#fff6e6', lightI: 1.6, hemiI: 1.0 },
  provision: { fixture: 'pantry', floor: '#d9b078', floorB: '#c99a60', wall: '#fff0d4', shelf: '#b0713f', trim: '#5a3418', accent: '#ee5a36', sky: '#fde9c8', light: '#ffe0b0', lightI: 1.7, hemiI: 0.95 },
  fruit_veg: { fixture: 'market', floor: '#dbe6c9', floorB: '#c6d6ac', wall: '#eaf7e0', shelf: '#bf8d57', trim: '#35682c', accent: '#2f9e5b', sky: '#e4f4d8', light: '#fff3cc', lightI: 1.7, hemiI: 1.0 },
  bakery: { fixture: 'counter', floor: '#ebd0a4', floorB: '#ddbb86', wall: '#fff1df', shelf: '#f3d9ab', trim: '#9b4a2a', accent: '#ee5a36', sky: '#fff0dc', light: '#ffd59a', lightI: 1.8, hemiI: 0.95 },
  dairy: { fixture: 'chilled', floor: '#eef6fb', floorB: '#dcebf5', wall: '#eef8fd', shelf: '#ffffff', trim: '#1f6fa8', accent: '#38b0e2', sky: '#e2f3fc', light: '#eaf6ff', lightI: 1.5, hemiI: 1.1 },
  household: { fixture: 'rack', floor: '#e2e6ec', floorB: '#cfd6df', wall: '#eef1f8', shelf: '#ffffff', trim: '#2b3990', accent: '#5b6cff', sky: '#e4e8f8', light: '#fffaf0', lightI: 1.5, hemiI: 1.05 },
}
