// Auth store. Backed by whatever the current data source provides.
// We use a singleton Zustand store so any screen can call useAuth()
// without prop-drilling.

import { create } from "zustand";
import type { AuthUser } from "@/types";
import { getDataSource } from "@/db";

const AUTH_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`${label} timed out — check your internet connection`),
          ),
        AUTH_TIMEOUT_MS,
      ),
    ),
  ]);
}

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
    set({ error: null });
    try {
      const ds = await getDataSource();
      const u = await withTimeout(ds.auth.restore(), "Session restore");
      set({ user: u });
    } catch (e) {
      set({ user: null, error: e instanceof Error ? e.message : String(e) });
    }
  },

  async signIn(email, password) {
    set({ isLoading: true, error: null });
    try {
      const ds = await getDataSource();
      const u = await withTimeout(
        ds.auth.signIn({ email, password }),
        "Sign in",
      );
      set({ user: u, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },

  async signUp(email, username, password) {
    set({ isLoading: true, error: null });
    try {
      const ds = await getDataSource();
      const u = await withTimeout(
        ds.auth.signUp({ email, username, password }),
        "Sign up",
      );
      set({ user: u, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },

  async signOut() {
    const ds = await getDataSource();
    await ds.auth.signOut();
    set({ user: null });
  },
}));
