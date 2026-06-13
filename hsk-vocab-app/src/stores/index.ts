import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UserProfile, HSKLevel } from '@/types'
import { authService } from '@/services/sqlite-api'

import { adminService, AdminUser } from '@/services/admin.service'

interface AuthState {
  user: UserProfile | null
  isGuest: boolean
  isLoading: boolean
  setUser: (user: UserProfile | null) => void
  setIsGuest: (isGuest: boolean) => void
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  signup: (email: string, password: string, username: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isGuest: false,
      isLoading: true,
      setUser: (user) => set({ user }),
      setIsGuest: (isGuest) => set({ isGuest }),
      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { user } = await authService.signIn(email, password)
          set({ user, isGuest: false, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      loginWithGoogle: async () => {
        set({ isLoading: true })
        try {
          await authService.signInWithGoogle()
          set({ isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      signup: async (email, password, username) => {
        set({ isLoading: true })
        try {
          const { user } = await authService.signUp(email, password, username)
          set({ user, isGuest: false, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      logout: async () => {
        await authService.signOut()
        set({ user: null, isGuest: true })
      },
      checkAuth: async () => {
        set({ isLoading: true })
        try {
          const token = authService.getToken()
          if (token) {
            const user = await authService.getCurrentUser()
            if (user) {
              set({ user, isGuest: false, isLoading: false })
              return
            }
          }
          const guestId = authService.getGuestId()
          set({
            user: {
              id: guestId,
              email: 'guest@local',
              username: 'Guest',
              avatar_url: '',
              daily_goal: 20,
              streak_count: 0,
              last_study_date: '',
              created_at: new Date().toISOString(),
            },
            isGuest: true,
            isLoading: false,
          })
        } catch {
          const guestId = authService.getGuestId()
          set({
            user: {
              id: guestId,
              email: 'guest@local',
              username: 'Guest',
              avatar_url: '',
              daily_goal: 20,
              streak_count: 0,
              last_study_date: '',
              created_at: new Date().toISOString(),
            },
            isGuest: true,
            isLoading: false,
          })
        }
      },
    }),
    {
      name: 'hsk-auth',
      partialize: (state) => ({ user: state.user, isGuest: state.isGuest }),
    }
  )
)

interface SettingsState {
  darkMode: boolean
  dailyGoal: number
  playbackSpeed: number
  quizTimer: number
  toggleDarkMode: () => void
  setDailyGoal: (goal: number) => void
  setPlaybackSpeed: (speed: number) => void
  setQuizTimer: (timer: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      dailyGoal: 20,
      playbackSpeed: 1.0,
      quizTimer: 10,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
      setQuizTimer: (quizTimer) => set({ quizTimer }),
    }),
    { name: 'hsk-settings' }
  )
)

interface ProgressState {
  selectedLevel: HSKLevel
  currentWordIndex: number
  sessionWords: string[]
  setSelectedLevel: (level: HSKLevel) => void
  setCurrentWordIndex: (index: number) => void
  setSessionWords: (words: string[]) => void
  nextWord: () => void
  prevWord: () => void
}

export const useProgressStore = create<ProgressState>((set) => ({
  selectedLevel: 1,
  currentWordIndex: 0,
  sessionWords: [],
  setSelectedLevel: (selectedLevel) => set({ selectedLevel, currentWordIndex: 0 }),
  setCurrentWordIndex: (currentWordIndex) => set({ currentWordIndex }),
  setSessionWords: (sessionWords) => set({ sessionWords }),
  nextWord: () => set((state) => ({ currentWordIndex: state.currentWordIndex + 1 })),
  prevWord: () => set((state) => ({ currentWordIndex: Math.max(0, state.currentWordIndex - 1) })),
}))

interface AdminState {
  admin: AdminUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAdminStore = create<AdminState>((set) => ({
  admin: null,
  isLoading: false,
  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { admin } = await adminService.login(email, password)
      set({ admin, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },
  logout: async () => {
    await adminService.logout()
    set({ admin: null, isLoading: false })
  },
  checkAuth: async () => {
    try {
      const admin = await adminService.checkAuth()
      set({ admin, isLoading: false })
    } catch {
      set({ admin: null, isLoading: false })
    }
  },
}))