// Browser TTS service for Chinese text.
// Uses the Web Speech API (window.speechSynthesis) — no third-party services,
// no API keys, fully offline. Picks the best available Chinese voice and
// chunks long passages to avoid Chrome's ~200 char truncation.

let cachedVoice: SpeechSynthesisVoice | null = null
let voicesReady: Promise<void> | null = null

export interface SpeakOptions {
  /** 0.1–10, default 1 */
  rate?: number
  /** 0–2, default 1 */
  pitch?: number
  /** Fired when all chunks finish speaking (via SpeechSynthesisUtterance.onend). */
  onEnd?: () => void
  /** Fired if speech is interrupted or fails to start. */
  onError?: () => void
}

export interface SpeakResult {
  ok: boolean
  hasChineseVoice: boolean
  error?: string
}

/** Wait until the browser's voice list is populated. */
export function voicesLoaded(): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve()
  }
  if (cachedVoice) return Promise.resolve()
  if (voicesReady) return voicesReady

  voicesReady = new Promise<void>((resolve) => {
    const check = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        cachedVoice = pickBestChineseVoice(voices)
        resolve()
      }
    }
    check()
    if (!cachedVoice) {
      window.speechSynthesis.addEventListener('voiceschanged', check, { once: true })
      // Some browsers never fire voiceschanged; resolve after 1s anyway
      setTimeout(() => {
        if (!cachedVoice) {
          cachedVoice = pickBestChineseVoice(window.speechSynthesis.getVoices())
          resolve()
        }
      }, 1000)
    }
  })
  return voicesReady
}

function pickBestChineseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // Prefer high-quality voices in this order.
  const preferred = [
    /Microsoft Xiaoxiao.*Chinese/i, // Edge / Windows
    /Microsoft Yunyang.*Chinese/i,
    /Microsoft Yaoyao.*Chinese/i,
    /Tingting/i, // macOS
    /Sin-Ji/i, // macOS
    /Mei-Jia/i, // macOS
    /zh-CN/i,
    /zh_CN/i,
    /zh-Hans/i,
    /zh/i,
  ]
  for (const re of preferred) {
    const hit = voices.find((v) => re.test(v.name) || re.test(v.lang))
    if (hit) return hit
  }
  return null
}

/** Split long Chinese text into chunks at sentence boundaries. */
function chunkText(text: string): string[] {
  if (text.length <= 200) return [text]
  const sentences = text.split(/(?<=[。！？!?\.])\s*/)
  const chunks: string[] = []
  let buf = ''
  for (const s of sentences) {
    if ((buf + s).length > 200 && buf) {
      chunks.push(buf.trim())
      buf = s
    } else {
      buf += s
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks
}

export async function speakChinese(text: string, options: SpeakOptions = {}): Promise<SpeakResult> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { ok: false, hasChineseVoice: false, error: 'speechSynthesis_not_supported' }
  }
  await voicesLoaded()
  window.speechSynthesis.cancel()
  const voice = cachedVoice
  if (!voice) {
    return { ok: false, hasChineseVoice: false, error: 'no_chinese_voice_installed' }
  }
  const chunks = chunkText(text)
  const lastIndex = chunks.length - 1
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk)
    u.voice = voice
    u.lang = voice.lang || 'zh-CN'
    u.rate = options.rate ?? 1
    u.pitch = options.pitch ?? 1
    // Only the last chunk signals completion.
    if (i === lastIndex) {
      u.onend = () => options.onEnd?.()
      u.onerror = () => options.onError?.()
    }
    window.speechSynthesis.speak(u)
  })
  return { ok: true, hasChineseVoice: true }
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

export function hasChineseVoice(): boolean {
  return cachedVoice !== null
}
