// Supabase Auth service for the web app.
// Uses Supabase Auth directly (not JWT-based mock auth).
// This replaces the in-database auth from sqlite-api.ts.

import { supabase, clearStoredToken, setStoredToken, isSupabaseConfigured, isDevelopment } from './supabase';
import { UserProfile } from '@/types';

const SUPER_ADMIN_EMAIL = 'miltonbabu9666@gmail.com';

export const supabaseAuthService = {
  async signUp(email: string, password: string, username: string): Promise<{ user: UserProfile; token: string }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sign-up failed');

    // The handle_new_user() trigger in Supabase auto-creates the profile row.
    // But it may not have the username from metadata. Update it.
    try {
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        email,
        username,
        is_admin: false,
        is_active: true,
        daily_goal: 20,
        streak_count: 0,
      }, { onConflict: 'id' });
    } catch {
      // Profile might already exist from the trigger — ignore
    }

    const session = data.session;
    if (session?.access_token) {
      setStoredToken(session.access_token);
    }

    const user: UserProfile = {
      id: data.user.id,
      email: data.user.email || email,
      username,
      avatar_url: '',
      daily_goal: 20,
      streak_count: 0,
      last_study_date: '',
      created_at: new Date().toISOString(),
    };
    return { user, token: session?.access_token || '' };
  },

  async signIn(email: string, password: string): Promise<{ user: UserProfile; token: string }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sign-in failed');

    // Fetch profile for streak/goal info
    let profile: any = null;
    try {
      const { data: p } = await supabase
        .from('user_profiles')
        .select('username, avatar_url, daily_goal, streak_count, last_study_date, created_at')
        .eq('id', data.user.id)
        .single();
      profile = p;
    } catch {
      // Profile might not exist yet — create it
    }

    const session = data.session;
    if (session?.access_token) {
      setStoredToken(session.access_token);
    }

    const user: UserProfile = {
      id: data.user.id,
      email: data.user.email || email,
      username: profile?.username || data.user.user_metadata?.username || email.split('@')[0],
      avatar_url: profile?.avatar_url || '',
      daily_goal: profile?.daily_goal || 20,
      streak_count: profile?.streak_count || 0,
      last_study_date: profile?.last_study_date || '',
      created_at: profile?.created_at || new Date().toISOString(),
    };
    return { user, token: session?.access_token || '' };
  },

  async signOut(): Promise<void> {
    clearStoredToken();
    try {
      await supabase.auth.signOut();
    } catch {
      // Session might already be expired
    }
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      clearStoredToken();
      return null;
    }

    // Fetch profile for additional fields
    let profile: any = null;
    try {
      const { data: p } = await supabase
        .from('user_profiles')
        .select('username, avatar_url, daily_goal, streak_count, last_study_date, created_at')
        .eq('id', data.user.id)
        .single();
      profile = p;
    } catch { /* ignore */ }

    return {
      id: data.user.id,
      email: data.user.email || '',
      username: profile?.username || data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'User',
      avatar_url: profile?.avatar_url || '',
      daily_goal: profile?.daily_goal || 20,
      streak_count: profile?.streak_count || 0,
      last_study_date: profile?.last_study_date || '',
      created_at: profile?.created_at || new Date().toISOString(),
    };
  },

  async updateUsername(userId: string, username: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      data: { username },
    });
    if (error) throw error;
    // Also update the profile table
    await supabase
      .from('user_profiles')
      .update({ username })
      .eq('id', userId);
  },

  getGuestId(): string {
    let guestId = localStorage.getItem('guest_id');
    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem('guest_id', guestId);
    }
    return guestId;
  },

  onAuthChange(callback: (user: UserProfile | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const user: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
          avatar_url: '',
          daily_goal: 20,
          streak_count: 0,
          last_study_date: '',
          created_at: new Date().toISOString(),
        };
        callback(user);
      } else {
        callback(null);
      }
    });
    return () => subscription.unsubscribe();
  },
};