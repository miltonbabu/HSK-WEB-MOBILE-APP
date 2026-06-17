import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UserProfile, HSKLevel } from '@/types'
import { authService } from '@/services/sqlite-api'
import { getGuestId, getGuestIdSync, getFallbackIdSync } from '@/services/guest-identity'

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
          if (user?.id) {
            // Migrate any local guest progress/sessions to the new user
            // account, then rekey the local rows so the user keeps a
            // seamless local history.
            import('@/services/migration')
              .then(({ migrateGuestToUser }) =>
                migrateGuestToUser(user.id).catch((err) =>
                  console.warn('[auth] guest migration failed', err),
                ),
              )
              .catch(() => {
                /* migration module not available — local-only mode */
              })
          }
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
        } catch {
          // fall through to guest path
        }

        // First-load fix: set a guest user SYNCHRONOUSLY (using a local-only
        // fallback ID) so the React tree can render without waiting on
        // /api/guest/identity. The IP-based ID is a background upgrade.
        const localId = getGuestIdSync() || getFallbackIdSync()
        set({
          user: {
            id: localId,
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

        // Background upgrade: if the server gives us a different IP-based
        // guest ID, swap to it. This keeps rate-limit counters consistent
        // across tabs/browsers from the same IP.
        getGuestId()
          .then((ipId) => {
            if (ipId && ipId !== localId) {
              try {
                const current = (useAuthStore.getState() as AuthState).user
                if (current && current.id === localId) {
                  set({ user: { ...current, id: ipId } })
                }
              } catch {
                /* ignore */
              }
            }
          })
          .catch(() => {
            /* keep local ID */
          })
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
  daysPerWeek: number
  playbackSpeed: number
  quizTimer: number
  hskLevel: number
  llmMode: 'auto' | 'local' | 'server'
  toggleDarkMode: () => void
  setDailyGoal: (goal: number) => void
  setDaysPerWeek: (n: number) => void
  setPlaybackSpeed: (speed: number) => void
  setQuizTimer: (timer: number) => void
  setHskLevel: (level: number) => void
  setLlmMode: (mode: 'auto' | 'local' | 'server') => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      dailyGoal: 20,
      daysPerWeek: 6,
      playbackSpeed: 1.0,
      quizTimer: 10,
      hskLevel: 1,
      llmMode: 'auto',
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      setDaysPerWeek: (daysPerWeek) => set({ daysPerWeek }),
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
      setQuizTimer: (quizTimer) => set({ quizTimer }),
      setHskLevel: (hskLevel) => set({ hskLevel }),
      setLlmMode: (llmMode) => set({ llmMode }),
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