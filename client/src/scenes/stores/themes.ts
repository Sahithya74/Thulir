import type { StoreCategory } from '@thulir/shared'

export type Fixture = 'aisle' | 'pantry' | 'market' | 'counter' | 'chilled' | 'rack'

/**
 * One reusable StoreEnvironment, six personalities. A theme is configuration only — colours, light and which fixture
 * style the shelving takes — so adding a store type never means writing a new scene.
 */
export interface StoreTheme {
  fixture: Fixture
  floor: string
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
  supermarket: { fixture: 'aisle', floor: '#c9c5b8', wall: '#ebe7dc', shelf: '#8f958f', trim: '#202522', accent: '#77856b', sky: '#eceae0', light: '#fff4e0', lightI: 2.0, hemiI: 1.0 },
  provision: { fixture: 'pantry', floor: '#9b7b57', wall: '#d9c3a0', shelf: '#8a5f38', trim: '#4d3420', accent: '#c98255', sky: '#e8d7b8', light: '#ffd9a0', lightI: 2.1, hemiI: 0.8 },
  fruit_veg: { fixture: 'market', floor: '#b9ad92', wall: '#bccaa8', shelf: '#a37b4c', trim: '#6f5436', accent: '#c98255', sky: '#dfe6cf', light: '#fff0c8', lightI: 2.2, hemiI: 1.0 },
  bakery: { fixture: 'counter', floor: '#d9c6a8', wall: '#f1e4cf', shelf: '#e8d4b0', trim: '#8a5a34', accent: '#c98255', sky: '#f3e4cb', light: '#ffc98a', lightI: 2.3, hemiI: 0.85 },
  dairy: { fixture: 'chilled', floor: '#d5dad8', wall: '#eef2f1', shelf: '#f4f7f6', trim: '#6f8f86', accent: '#a8b89a', sky: '#e9f0ef', light: '#e8f6ff', lightI: 2.0, hemiI: 1.1 },
  household: { fixture: 'rack', floor: '#b9bcb6', wall: '#e4e6e1', shelf: '#eceee9', trim: '#4a504b', accent: '#77856b', sky: '#e4e8e4', light: '#fffaf0', lightI: 2.0, hemiI: 1.0 },
}
