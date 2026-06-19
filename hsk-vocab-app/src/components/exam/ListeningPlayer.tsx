import { useEffect, useRef, useState } from 'react'
import { Volume2, Loader2, AlertCircle } from 'lucide-react'
import { speakChinese, stopSpeaking, voicesLoaded } from '@/services/speech.service'

interface Props {
  text: string
  autoPlay?: boolean
  speed?: number
  /** Fired when audio playback ends. Used to sequence image reveal. */
  onEnd?: () => void
}

export default function ListeningPlayer({ text, autoPlay = true, speed = 1, onEnd }: Props) {
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const spokenRef = useRef(false)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  // Pre-warm the voice list so the first speak picks the best Chinese voice.
  useEffect(() => {
    voicesLoaded().then(() => setReady(true))
  }, [])

  const handleSpeak = async () => {
    setError(null)
    const res = await speakChinese(text, {
      rate: speed,
      onEnd: () => {
        setPlaying(false)
        onEndRef.current?.()
      },
      onError: () => {
        setPlaying(false)
        onEndRef.current?.()
      },
    })
    if (!res.ok) {
      setError(
        res.error === 'no_chinese_voice_installed'
          ? 'No Chinese voice on this device — install one in your OS settings.'
          : 'Browser does not support speech synthesis.',
      )
      // Treat the failed case as "audio done" so the rest of the UI unblocks.
      onEndRef.current?.()
      return
    }
    setPlaying(true)
    // Safety fallback: if the onend event never fires (known Chrome bug),
    // unlock the UI after a generous timeout based on text length.
    const safetyMs = Math.max(10000, (text.length / 2) * 1000)
    setTimeout(() => {
      setPlaying(false)
      onEndRef.current?.()
    }, safetyMs)
  }

  // Auto-play once when ready.
  useEffect(() => {
    if (!autoPlay || spokenRef.current || !ready) return
    spokenRef.current = true
    const t = setTimeout(handleSpeak, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, autoPlay])

  // Cleanup on unmount.
  useEffect(() => () => stopSpeaking(), [])

  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-ink-500 dark:text-ink-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Preparing audio...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
        <AlertCircle className="w-4 h-4" />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => {
        if (!playing) handleSpeak()
      }}
      disabled={playing}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-70 text-white font-semibold text-sm transition-colors"
    >
      <Volume2 className="w-4 h-4" />
      {playing ? 'Playing...' : 'Replay audio'}
    </button>
  )
}
