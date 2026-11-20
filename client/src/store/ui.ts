import { create } from 'zustand'
import type { Lang } from '@/services/i18n'

const LANG_KEY = 'thulir.lang'

function readLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'en' || v === 'ta') return v
  } catch {
    /* storage unavailable */
  }
  return 'en'
}

interface UiState {
  lang: Lang
  setLang: (l: Lang) => void
  /** True once the user has passed the entry screen this session. */
  entered: boolean
  setEntered: (v: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  lang: readLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang
    set({ lang })
  },
  entered: false,
  setEntered: (entered) => set({ entered }),
}))

document.documentElement.lang = useUiStore.getState().lang
