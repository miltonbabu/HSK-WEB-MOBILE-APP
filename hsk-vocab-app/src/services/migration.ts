// Guest-to-user migration: transfers local-first progress + sessions
// from a stable guest id to a real user account when they sign in.
// Uploads to Supabase when online, otherwise just rekeys the local
// rows so the data is owned by the new user going forward.

import { query, run, saveDatabase } from './sqlite-db'
import { supabase } from './supabase'
import { isSupabaseConfigured } from './supabase'

const GUEST_KEY = 'guest_id'

export function getLocalGuestId(): string | null {
  try {
    let guest = localStorage.getItem(GUEST_KEY)
    if (!guest) {
      guest = crypto.randomUUID()
      localStorage.setItem(GUEST_KEY, guest)
    }
    return guest
  } catch {
    return null
  }
}

function rekeyLocalRows(table: string, fromUserId: string, toUserId: string): number {
  try {
    run(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`, [toUserId, fromUserId])
    saveDatabase()
    return 1
  } catch (err) {
    console.warn(`[migration] failed to rekey ${table}:`, err)
    return 0
  }
}

export interface MigrationResult {
  progress: number
  sessions: number
  uploaded: boolean
}

export async function migrateGuestToUser(newUserId: string): Promise<MigrationResult> {
  const guestId = getLocalGuestId()
  if (!guestId || guestId === newUserId) {
    return { progress: 0, sessions: 0, uploaded: true }
  }

  let progressRows: any[] = []
  let sessionRows: any[] = []

  try {
    progressRows = query('SELECT * FROM user_progress WHERE user_id = ?', [guestId])
    sessionRows = query('SELECT * FROM study_sessions WHERE user_id = ?', [guestId])
  } catch (err) {
    console.warn('[migration] could not read local data:', err)
  }

  let uploaded = false
  if (navigator.onLine && isSupabaseConfigured() && (progressRows.length || sessionRows.length)) {
    try {
      if (progressRows.length) {
        const { error: pErr } = await supabase
          .from('user_progress')
          .upsert(progressRows.map((r) => ({ ...r, user_id: newUserId })))
        if (pErr) throw pErr
      }
      if (sessionRows.length) {
        const { error: sErr } = await supabase
          .from('study_sessions')
          .insert(sessionRows.map((r) => ({ ...r, user_id: newUserId })))
        if (sErr) throw sErr
      }
      uploaded = true
    } catch (err) {
      console.warn('[migration] supabase upload failed, will rekey locally:', err)
    }
  }

  rekeyLocalRows('user_progress', guestId, newUserId)
  rekeyLocalRows('study_sessions', guestId, newUserId)
  try { localStorage.setItem(GUEST_KEY, newUserId) } catch { /* ignore */ }

  return { progress: progressRows.length, sessions: sessionRows.length, uploaded }
}
