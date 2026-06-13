import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type LearningReason = 'hsk_exam' | 'conversation' | 'travel' | 'culture' | 'work' | 'other' | '';

interface SettingsState {
  darkMode: boolean;
  themeMode: ThemeMode;
  dailyGoal: number;
  speechRate: number;
  hapticsEnabled: boolean;
  // Onboarding
  hskLevel: number;
  learningReason: LearningReason;
  onboardingCompleted: boolean;
  // Actions
  setDarkMode: (v: boolean) => void;
  setThemeMode: (m: ThemeMode) => void;
  setDailyGoal: (n: number) => void;
  setSpeechRate: (n: number) => void;
  setHaptics: (v: boolean) => void;
  setOnboarding: (data: { hskLevel: number; dailyGoal: number; learningReason: LearningReason }) => void;
  setHskLevel: (n: number) => void;
  setLearningReason: (r: LearningReason) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      themeMode: 'system',
      dailyGoal: 20,
      speechRate: 0.8,
      hapticsEnabled: true,
      hskLevel: 1,
      learningReason: '',
      onboardingCompleted: false,
      setDarkMode: (v) => set({ darkMode: v }),
      setThemeMode: (m) => set({ themeMode: m, darkMode: m === 'dark' }),
      setDailyGoal: (n) => set({ dailyGoal: n }),
      setSpeechRate: (n) => set({ speechRate: n }),
      setHaptics: (v) => set({ hapticsEnabled: v }),
      setOnboarding: (data) => set({
        hskLevel: data.hskLevel,
        dailyGoal: data.dailyGoal,
        learningReason: data.learningReason,
        onboardingCompleted: true,
      }),
      setHskLevel: (n) => set({ hskLevel: n }),
      setLearningReason: (r) => set({ learningReason: r }),
    }),
    {
      name: 'hsk-mobile-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
