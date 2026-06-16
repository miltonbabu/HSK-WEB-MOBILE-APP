import { create } from 'zustand'

interface AIInputState {
  /** True while the AI tutor input textarea is focused (any device). */
  inputFocused: boolean
  setInputFocused: (focused: boolean) => void
}

export const useAIInputStore = create<AIInputState>((set) => ({
  inputFocused: false,
  setInputFocused: (focused) => set({ inputFocused: focused }),
}))
