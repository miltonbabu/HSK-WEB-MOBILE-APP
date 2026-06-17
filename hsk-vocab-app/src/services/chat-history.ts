import { ChatSession, ChatMessage } from './ai-chat'
import { ensureDb, run, query } from './database'

/**
 * Persistence for AI tutor chat history.
 *
 * - **Registered users** → SQLite database (chat_sessions + chat_messages).
 *   Their history survives across devices/browsers once they sign in.
 * - **Guest users** → localStorage. They aren't tied to an account, so the
 *   data lives on whatever device they're using.
 *
 * The functions are async because the database path can be slow on first
 * call. Guest paths still hit localStorage synchronously, but the API
 * stays uniform so callers don't need to branch.
 */

const SESSIONS_KEY = 'hsk-chat-sessions-v2'

// ── localStorage helpers (guest path) ───────────────────────────

function loadFromLocalStorage(): ChatSession[] {
  try {
    const data = localStorage.getItem(SESSIONS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveToLocalStorage(sessions: ChatSession[]): void {
  // Strip transient fields (Word[] on messages) to keep localStorage small
  const slim = sessions.map((s) => ({
    ...s,
    messages: s.messages.map((m) => ({ ...m, words: undefined })),
  }))
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(slim))
  } catch {
    // Quota exceeded — fall back to keeping only the 10 most recent sessions
    try {
      const trimmed = slim.slice(0, 10)
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed))
    } catch {
      /* give up silently */
    }
  }
}

// ── Database helpers (registered-user path) ─────────────────────

function rowToSession(row: any, messages: ChatMessage[]): ChatSession {
  return {
    id: row.id,
    title: row.title,
    messages,
    createdAt: row.created_at,
    userId: row.user_id,
    mode: row.mode || undefined,
    contextId: row.context_id || undefined,
    contextTitle: row.context_title || undefined,
  }
}

function messageRowToMessage(row: any): ChatMessage {
  let words: ChatMessage['words']
  if (row.words) {
    try {
      words = JSON.parse(row.words)
    } catch {
      words = undefined
    }
  }
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    words,
  }
}

function loadFromDatabase(userId: string): ChatSession[] {
  const sessionRows = query(
    'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
    [userId],
  )
  if (sessionRows.length === 0) return []
  const messageRows = query(
    `SELECT * FROM chat_messages WHERE session_id IN (${sessionRows.map(() => '?').join(',')}) ORDER BY timestamp ASC`,
    sessionRows.map((r: any) => r.id),
  )
  const bySession: Record<string, ChatMessage[]> = {}
  for (const row of messageRows) {
    const sid = (row as any).session_id
    if (!bySession[sid]) bySession[sid] = []
    bySession[sid].push(messageRowToMessage(row))
  }
  return sessionRows.map((r: any) => rowToSession(r, bySession[r.id] || []))
}

function saveSessionToDatabase(session: ChatSession): void {
  // Upsert the session row
  const existing = query('SELECT id FROM chat_sessions WHERE id = ?', [session.id])
  if (existing.length === 0) {
    run(
      `INSERT INTO chat_sessions (id, user_id, title, mode, context_id, context_title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.userId,
        session.title,
        session.mode || 'chat',
        session.contextId || null,
        session.contextTitle || null,
        session.createdAt,
        Date.now(),
      ],
    )
  } else {
    run(
      `UPDATE chat_sessions SET title = ?, mode = ?, context_id = ?, context_title = ?, updated_at = ? WHERE id = ?`,
      [
        session.title,
        session.mode || 'chat',
        session.contextId || null,
        session.contextTitle || null,
        Date.now(),
        session.id,
      ],
    )
    // Replace the message list — simpler than diffing and keeps storage in sync
    run('DELETE FROM chat_messages WHERE session_id = ?', [session.id])
  }
  for (const m of session.messages) {
    run(
      `INSERT INTO chat_messages (id, session_id, role, content, words, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        session.id,
        m.role,
        m.content,
        m.words ? JSON.stringify(m.words) : null,
        m.timestamp,
      ],
    )
  }
}

function deleteSessionFromDatabase(id: string): void {
  run('DELETE FROM chat_sessions WHERE id = ?', [id])
}

// ── Public API ──────────────────────────────────────────────────

export interface ChatStorageContext {
  userId: string
  isGuest: boolean
}

export const chatHistory = {
  /** Load all sessions for the given user (DB for registered, localStorage for guest). */
  async load(ctx: ChatStorageContext): Promise<ChatSession[]> {
    if (ctx.isGuest) return loadFromLocalStorage()
    try {
      await ensureDb()
      return loadFromDatabase(ctx.userId)
    } catch (e) {
      console.warn('Failed to load chat history from database, falling back to localStorage:', e)
      return loadFromLocalStorage()
    }
  },

  /**
   * Persist the entire session list.
   *
   * For the database path this is a write-through: we sync every session
   * to the DB. We avoid diffing because sessions are small (<200 messages
   * in practice) and the call is debounced by the AIChat component.
   */
  async save(sessions: ChatSession[], ctx: ChatStorageContext): Promise<void> {
    if (ctx.isGuest) {
      saveToLocalStorage(sessions)
      return
    }
    try {
      await ensureDb()
      // Sync each session — runs are debounced internally by the DB layer
      for (const s of sessions) {
        if (s.userId === ctx.userId) saveSessionToDatabase(s)
      }
    } catch (e) {
      console.warn('Failed to save chat history to database, falling back to localStorage:', e)
      saveToLocalStorage(sessions)
    }
  },

  async delete(id: string, ctx: ChatStorageContext): Promise<void> {
    if (ctx.isGuest) {
      const all = loadFromLocalStorage().filter((s) => s.id !== id)
      saveToLocalStorage(all)
      return
    }
    try {
      await ensureDb()
      deleteSessionFromDatabase(id)
    } catch (e) {
      console.warn('Failed to delete chat session from database:', e)
    }
  },

  async clearAll(ctx: ChatStorageContext): Promise<void> {
    if (ctx.isGuest) {
      localStorage.removeItem(SESSIONS_KEY)
      return
    }
    try {
      await ensureDb()
      run('DELETE FROM chat_sessions WHERE user_id = ?', [ctx.userId])
    } catch (e) {
      console.warn('Failed to clear chat history from database:', e)
    }
  },
}
