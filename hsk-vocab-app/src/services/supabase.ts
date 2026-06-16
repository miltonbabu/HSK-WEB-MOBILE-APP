import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Avoid creating a live client until actually configured (prevents network noise in dev).
let _client: SupabaseClient | null = null
function getClient(): SupabaseClient {
  if (!_client) {
    if (!isSupabaseConfigured()) {
      // Build a client with dummy values; all real calls are gated on isSupabaseConfigured().
      _client = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    } else {
      _client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    }
  }
  return _client
}

// Expose the full SupabaseClient directly. We use getters that resolve to the
// live client on each access so that auth/schema/table methods are always
// invoked with the correct `this` binding from the actual client instance.
//
// When Supabase is NOT configured (missing env vars), this returns a Proxy
// that short-circuits all calls with empty results — so the app works in
// guest/offline mode without generating network errors to placeholder.supabase.co.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!isSupabaseConfigured()) {
      // Return a no-op proxy for chainable methods like .from().select()
      return new Proxy(() => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }), {
        get(_t, subProp) {
          if (subProp === 'then') return undefined // not a promise
          return new Proxy(() => ({}), {
            get(_t, _p) {
              return () => ({ data: null, error: { message: 'Supabase not configured' }, count: 0 })
            },
          })
        },
      }) as any
    }
    const client = getClient()
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})

export const APP_MODE = (import.meta.env.VITE_APP_MODE || 'development') as 'development' | 'production'

export const isDevelopment = APP_MODE === 'development'

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')
  )
}

export const JWT_KEY = 'hsk-auth-token'
export const ADMIN_JWT_KEY = 'hsk-admin-token'

export function getStoredToken(): string | null {
  return localStorage.getItem(JWT_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(JWT_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(JWT_KEY)
}

export function getStoredAdminToken(): string | null {
  return localStorage.getItem(ADMIN_JWT_KEY)
}

export function setStoredAdminToken(token: string): void {
  localStorage.setItem(ADMIN_JWT_KEY, token)
}

export function clearStoredAdminToken(): void {
  localStorage.removeItem(ADMIN_JWT_KEY)
}

export function parseTokenPayload(token: string): { sub?: string; email?: string; username?: string; exp?: number; role?: string } | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function createMockJWT(payload: { sub: string; email: string; username: string }): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'mock', typ: 'JWT' }))

  const body = base64UrlEncode(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 14400,
  }))

  const signature = base64UrlEncode('mock-signature')

  return `${header}.${body}.${signature}`
}

export function createMockAdminJWT(payload: { sub: string; email: string; username: string }): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'mock', typ: 'JWT' }))

  const body = base64UrlEncode(JSON.stringify({
    ...payload,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 14400,
  }))

  const signature = base64UrlEncode('mock-signature')

  return `${header}.${body}.${signature}`
}

export async function hashPassword(password: string): Promise<string> {
  const salted = password + 'hsk-salt-2026'
  if (crypto.subtle) {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(salted)
      const hash = await crypto.subtle.digest('SHA-256', data)
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch {}
  }
  // Fallback: simple hash for environments without crypto.subtle
  let hash = 0
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(64, '0')
}