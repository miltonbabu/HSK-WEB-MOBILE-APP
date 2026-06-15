// In-browser LLM via WebLLM (MLC-AI) over WebGPU.
//
// Loads the Qwen2.5-1.5B-Instruct model on demand, caches weights in the
// browser Cache API, and exposes a streaming chat-completion API. Falls
// back gracefully when WebGPU is missing or the model fails to load — the
// dispatcher in `llm.ts` will then route calls to the server LLM.

import type { InitProgressReport, MLCEngineInterface } from '@mlc-ai/web-llm'

// Qwen2.5-1.5B-Instruct, 4-bit weights, f16 activations.
// ~1.0 GB download, good Chinese support, fits on most modern devices.
export const LOCAL_LLM_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'

export type LocalLLMStatus =
  | 'unsupported'   // WebGPU unavailable in this browser/device
  | 'idle'          // Ready, no model loaded yet
  | 'loading'       // Downloading / compiling
  | 'ready'         // Model loaded, can generate
  | 'error'         // Last load attempt failed (user can retry)
  | 'disabled'      // User explicitly disabled local LLM in settings

export interface LocalLLMProgress {
  status: LocalLLMStatus
  progress: number  // 0..1
  text: string
  error?: string
}

type Listener = (p: LocalLLMProgress) => void

class LocalLLMService {
  private engine: MLCEngineInterface | null = null
  private loadingPromise: Promise<void> | null = null
  private listeners = new Set<Listener>()
  private state: LocalLLMProgress = { status: 'idle', progress: 0, text: '' }
  private webgpuChecked = false
  private webgpuAvailable = false

  /** Whether the current browser exposes a WebGPU device. */
  hasWebGPU(): boolean {
    if (this.webgpuChecked) return this.webgpuAvailable
    if (typeof navigator === 'undefined') {
      this.webgpuChecked = true
      this.webgpuAvailable = false
      return false
    }
    // The standard navigator.gpu is the only reliable check.
    // (Not yet in lib.dom.d.ts; cast to any to access it.)
    this.webgpuAvailable = !!(navigator as unknown as { gpu?: unknown }).gpu
    this.webgpuChecked = true
    return this.webgpuAvailable
  }

  /** Current status snapshot. */
  getState(): LocalLLMProgress {
    return { ...this.state }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.getState())
    return () => { this.listeners.delete(fn) }
  }

  private setState(patch: Partial<LocalLLMProgress>) {
    this.state = { ...this.state, ...patch }
    for (const fn of this.listeners) fn(this.getState())
  }

  /** Manually mark the local LLM as disabled (from settings). */
  setDisabled(disabled: boolean) {
    if (disabled) this.setState({ status: 'disabled' })
    else if (this.state.status === 'disabled') this.setState({ status: 'idle' })
  }

  /**
   * Load the model. Idempotent: concurrent calls share the same load
   * promise. Returns when the engine is ready to generate.
   */
  async load(): Promise<void> {
    if (!this.hasWebGPU()) {
      this.setState({ status: 'unsupported', text: 'WebGPU is not available in this browser.' })
      throw new Error('WebGPU unavailable')
    }
    if (this.state.status === 'ready' && this.engine) return
    if (this.loadingPromise) return this.loadingPromise

    this.loadingPromise = (async () => {
      this.setState({ status: 'loading', progress: 0, text: 'Starting download…' })
      try {
        // Dynamic import — keeps the WASM bundle out of the initial chunk
        // and only loads when the user actually wants local LLM.
        const webllm = await import('@mlc-ai/web-llm')

        const engine = await webllm.CreateMLCEngine(LOCAL_LLM_MODEL_ID, {
          initProgressCallback: (report: InitProgressReport) => {
            this.setState({
              status: 'loading',
              progress: report.progress,
              text: report.text,
            })
          },
        })

        this.engine = engine
        this.setState({ status: 'ready', progress: 1, text: 'Model ready' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.setState({ status: 'error', error: msg, text: msg })
        throw err
      } finally {
        this.loadingPromise = null
      }
    })()

    return this.loadingPromise
  }

  /**
   * Stream a chat completion from the local LLM. Throws if the model
   * isn't ready — callers should `load()` first or fall back to server.
   */
  async *stream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: { temperature?: number; max_tokens?: number; signal?: AbortSignal } = {},
  ): AsyncGenerator<string, void, void> {
    if (!this.engine || this.state.status !== 'ready') {
      throw new Error('Local LLM not ready')
    }

    const iterable = await this.engine.chat.completions.create({
      messages,
      stream: true,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.max_tokens ?? 512,
    })

    for await (const chunk of iterable) {
      if (options.signal?.aborted) {
        this.engine.interruptGenerate()
        return
      }
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) yield delta
    }
  }

  /** Free GPU resources. Safe to call multiple times. */
  async unload(): Promise<void> {
    if (this.engine) {
      try { await this.engine.unload() } catch { /* ignore */ }
      this.engine = null
    }
    if (this.state.status === 'ready' || this.state.status === 'loading') {
      this.setState({ status: 'idle', progress: 0, text: '' })
    }
  }

  /** True iff the model is loaded and can generate. */
  isReady(): boolean {
    return this.state.status === 'ready' && !!this.engine
  }
}

export const localLLM = new LocalLLMService()
