// Unified LLM dispatcher.
//
// Routes chat completions to either the in-browser LLM (WebLLM, WebGPU)
// or the server LLM (DeepSeek via /api/ai/chat). The choice depends on
// the user's `llmMode` setting and runtime capabilities:
//
//   - 'auto'      → use local when ready; otherwise server
//   - 'local'     → only use local; throw if it can't run
//   - 'server'    → only use server; throw if offline
//
// Callers get a single async-iterable API — they don't need to know
// which backend is in use.

import { localLLM, LOCAL_LLM_MODEL_ID, LocalLLMProgress, LocalLLMStatus } from './local-llm'

export type LLMMode = 'auto' | 'local' | 'server'

export type LLMBackend = 'local' | 'server'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMGenerateOptions {
  temperature?: number
  max_tokens?: number
  signal?: AbortSignal
  /** Hint to prefer a particular backend — used internally for retries. */
  prefer?: LLMBackend
}

export interface LLMResult {
  content: string
  backend: LLMBackend
}

// ── Server LLM config (mirrors ai-chat.ts) ──────────────────────
// The browser NEVER talks to DeepSeek directly. The DeepSeek API key is
// held server-side in /api/ai/chat. This dispatcher only chooses between
// the in-browser WebLLM model and that proxy.
function getServerConfig(): { url: string; authHeader: () => Record<string, string> } {
  const backendUrl = import.meta.env.VITE_AI_BACKEND_URL as string | undefined

  if (backendUrl) {
    return { url: backendUrl, authHeader: () => ({}) }
  }
  return { url: '/api/ai/chat', authHeader: () => ({}) }
}

const SERVER_CONFIG = getServerConfig()
const SERVER_TIMEOUT = 15_000

function getCurrentUserId(): string {
  try {
    const auth = localStorage.getItem('hsk-auth')
    if (auth) {
      const parsed = JSON.parse(auth)
      if (parsed?.state?.user?.id) return parsed.state.user.id
    }
    let guest = localStorage.getItem('guest_id')
    if (!guest) {
      guest = crypto.randomUUID()
      localStorage.setItem('guest_id', guest)
    }
    return guest
  } catch {
    return 'guest'
  }
}

async function* streamFromServer(
  messages: ChatMessage[],
  options: LLMGenerateOptions,
): AsyncGenerator<string, void, void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT)
  // Tie the caller-supplied signal to our timeout controller.
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...SERVER_CONFIG.authHeader(),
    }
    const url = SERVER_CONFIG.url
    if (url.startsWith('/') || url.includes('localhost') || url.includes('vercel.app') || url.includes('hsk')) {
      headers['X-User-Id'] = getCurrentUserId()
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        stream: true,
        temperature: options.temperature ?? 0.5,
        max_tokens: options.max_tokens ?? 512,
      }),
      signal: controller.signal,
    })

    if (!response.ok || !response.body) {
      throw new Error(`Server LLM returned ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

// ── Dispatcher ───────────────────────────────────────────────────

/**
 * Pick the backend that should run this request, based on:
 *   - explicit `prefer` hint
 *   - user `llmMode` setting
 *   - local LLM readiness / WebGPU availability
 *   - network status
 */
export function pickBackend(
  mode: LLMMode,
  prefer: LLMBackend | undefined,
  online: boolean,
): LLMBackend {
  const localOk = localLLM.isReady()
  const canUseServer = online // server call needs network
  const webgpuOk = localLLM.hasWebGPU()

  if (prefer === 'local' || (mode === 'local' && webgpuOk)) {
    if (!localOk) throw new Error('Local LLM requested but not ready')
    return 'local'
  }
  if (prefer === 'server' || mode === 'server') {
    if (!canUseServer) throw new Error('Server LLM requested but offline')
    return 'server'
  }

  // Auto: prefer local if ready, else server, else error.
  if (localOk) return 'local'
  if (canUseServer) return 'server'
  throw new Error('No LLM available: local model not loaded and offline')
}

/**
 * Stream a chat completion from the configured backend. Yields raw
 * content deltas. If the chosen backend fails, the generator throws —
 * callers that want automatic fallback should use `chatWithFallback`.
 */
export async function* streamChat(
  messages: ChatMessage[],
  mode: LLMMode,
  options: LLMGenerateOptions = {},
): AsyncGenerator<string, void, void> {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  const backend = pickBackend(mode, options.prefer, online)

  if (backend === 'local') {
    yield* localLLM.stream(messages, options)
  } else {
    yield* streamFromServer(messages, options)
  }
}

/**
 * Like `streamChat` but collects the full response and returns it along
 * with the backend that actually served it.
 */
export async function chat(
  messages: ChatMessage[],
  mode: LLMMode,
  options: LLMGenerateOptions = {},
): Promise<LLMResult> {
  let content = ''
  for await (const delta of streamChat(messages, mode, options)) {
    content += delta
  }
  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  return { content, backend: pickBackend(mode, options.prefer, online) }
}

/**
 * Auto-mode chat with one fallback hop: if the local LLM throws
 * (e.g. WebGPU context lost mid-generation), retry the server LLM
 * once. If the server fails too, the original error is re-thrown.
 */
export async function chatWithFallback(
  messages: ChatMessage[],
  options: LLMGenerateOptions = {},
): Promise<LLMResult> {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  const tryLocal = localLLM.isReady() && (options.prefer ?? 'local') !== 'server'
  if (tryLocal) {
    try {
      let content = ''
      for await (const delta of localLLM.stream(messages, options)) {
        content += delta
      }
      return { content, backend: 'local' }
    } catch (err) {
      console.warn('[llm] local failed, falling back to server:', err)
      if (!online) throw err
    }
  }
  if (!online) throw new Error('Offline and local LLM not ready')
  let content = ''
  for await (const delta of streamFromServer(messages, options)) {
    content += delta
  }
  return { content, backend: 'server' }
}

// ── Status helpers (re-exported for UI) ──────────────────────────

export { LOCAL_LLM_MODEL_ID }
export type { LocalLLMProgress, LocalLLMStatus }

/** Subscribe to local LLM status changes. */
export function subscribeLocalLLM(fn: (p: LocalLLMProgress) => void): () => void {
  return localLLM.subscribe(fn)
}

/** Begin downloading the local model. Idempotent. */
export function loadLocalLLM(): Promise<void> {
  return localLLM.load()
}

/** Free local model resources. */
export function unloadLocalLLM(): Promise<void> {
  return localLLM.unload()
}

/** Apply a user toggle to enable/disable the local LLM. */
export function setLocalLLMDisabled(disabled: boolean) {
  localLLM.setDisabled(disabled)
  if (disabled) void unloadLocalLLM()
}
