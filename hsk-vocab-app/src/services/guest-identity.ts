// Guest identity service — uses the visitor's IP address as a
// consistent guest ID so that opening a new tab or browser
// doesn't reset the guest's daily rate-limit counters.
//
// How it works:
// 1. Call GET /api/guest/identity to get the real IP from Vercel.
// 2. Use that IP as the guest user_id (hashed for privacy).
// 3. Cache the result for the session so we don't hit the API on
//    every render.
// 4. Fall back to a local-only guest ID if the API is unreachable.

const SESSION_KEY = 'hsk-guest-identity'
const FALLBACK_KEY = 'hsk-guest-fallback'

interface GuestIdentity {
  ip: string
  fingerprint: string
}

function getFallbackId(): string {
  if (typeof localStorage === 'undefined') return 'guest-' + Date.now()
  let id = localStorage.getItem(FALLBACK_KEY)
  if (!id) {
    id = 'guest-' + crypto.randomUUID()
    localStorage.setItem(FALLBACK_KEY, id)
  }
  return id
}

/**
 * Synchronous, always-available local-only guest ID. Use this for the
 * first render so the React tree can mount before the network resolves.
 * Safe to call at module init time (uses localStorage only).
 */
export function getFallbackIdSync(): string {
  try {
    if (typeof localStorage === 'undefined') return 'guest-' + Date.now()
    let id = localStorage.getItem(FALLBACK_KEY)
    if (!id) {
      // crypto.randomUUID is widely available in evergreen browsers; if
      // somehow missing, fall back to a Math.random() UUIDv4-shaped string.
      const uuid =
        typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
          ? (crypto as any).randomUUID()
          : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      id = 'guest-' + uuid
      localStorage.setItem(FALLBACK_KEY, id)
    }
    return id
  } catch {
    return 'guest-' + Date.now()
  }
}

function hashIp(ip: string): string {
  // Simple hash so we don't store raw IPs in localStorage
  let hash = 0
  for (let i = 0; i < ip.length; i++) {
    const chr = ip.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return 'guest-ip-' + Math.abs(hash).toString(36)
}

async function fetchIdentity(): Promise<GuestIdentity | null> {
  try {
    const resp = await fetch('/api/guest/identity', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!resp.ok) return null
    const data = await resp.json()
    if (data && data.ip) {
      return { ip: data.ip, fingerprint: data.fingerprint || data.ip }
    }
    return null
  } catch {
    return null
  }
}

export async function getGuestId(): Promise<string> {
  // Return cached session identity if available
  if (typeof sessionStorage !== 'undefined') {
    const cached = sessionStorage.getItem(SESSION_KEY)
    if (cached) return cached
  }

  // Try fetching from API
  const identity = await fetchIdentity()
  if (identity) {
    const guestId = hashIp(identity.ip)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, guestId)
    }
    return guestId
  }

  // Fallback: use local-only guest ID
  return getFallbackId()
}

/**
 * Get the guest ID synchronously from cache.
 * Returns null if not yet fetched — caller should use getGuestId() first.
 */
export function getGuestIdSync(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(SESSION_KEY)
}