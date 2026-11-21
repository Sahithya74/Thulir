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
  supermarket: { fixture: 'aisle', floor: '#efe6d6', floorB: '#e0d3bc', wall: '#fff8ea', shelf: '#d9cbb2', trim: '#2b1a12', accent: '#3f7a3a', sky: '#fde7c4', light: '#ffe9c4', lightI: 1.6, hemiI: 1.0 },
  provision: { fixture: 'pantry', floor: '#d9b078', floorB: '#c99a60', wall: '#fff0d4', shelf: '#b0713f', trim: '#5a3418', accent: '#d94f2b', sky: '#fde9c8', light: '#ffe0b0', lightI: 1.7, hemiI: 0.95 },
  fruit_veg: { fixture: 'market', floor: '#dbe6c9', floorB: '#c6d6ac', wall: '#eaf7e0', shelf: '#bf8d57', trim: '#35682c', accent: '#2f9e5b', sky: '#e4f4d8', light: '#fff3cc', lightI: 1.7, hemiI: 1.0 },
  bakery: { fixture: 'counter', floor: '#ebd0a4', floorB: '#ddbb86', wall: '#fff1df', shelf: '#f3d9ab', trim: '#9b4a2a', accent: '#d94f2b', sky: '#fff0dc', light: '#ffd59a', lightI: 1.8, hemiI: 0.95 },
  dairy: { fixture: 'chilled', floor: '#f3f0ea', floorB: '#e3ded2', wall: '#fbf6ec', shelf: '#ffffff', trim: '#1f6f8a', accent: '#2fa4c4', sky: '#fff0d8', light: '#fff1d8', lightI: 1.5, hemiI: 1.1 },
  household: { fixture: 'rack', floor: '#e8e0d4', floorB: '#d6cbb9', wall: '#f8f2e8', shelf: '#ffffff', trim: '#4a2f6e', accent: '#7a4fd0', sky: '#fdebd2', light: '#ffeccc', lightI: 1.5, hemiI: 1.05 },
}
