// Auth store. Backed by whatever the current data source provides.
// We use a singleton Zustand store so any screen can call useAuth()
// without prop-drilling.

import { create } from 'zustand';
import type { AuthUser } from '@/types';
import { getDataSource } from '@/db';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  setUser: (u) => set({ user: u }),

  async init() {
    set({ isLoading: true, error: null });
    try {
      const ds = await getDataSource();
      const u = await ds.auth.restore();
      set({ user: u, isLoading: false });
    } catch (e) {
      set({ user: null, isLoading: false, error: String(e) });
    }
  },

  async signIn(email, password) {
    set({ isLoading: true, error: null });
    try {
      const ds = await getDataSource();
      const u = await ds.auth.signIn({ email, password });
      set({ user: u, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  async signUp(email, username, password) {
    set({ isLoading: true, error: null });
    try {
      const ds = await getDataSource();
      const u = await ds.auth.signUp({ email, username, password });
      set({ user: u, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  async signOut() {
    const ds = await getDataSource();
    await ds.auth.signOut();
    set({ user: null });
  },
}));
