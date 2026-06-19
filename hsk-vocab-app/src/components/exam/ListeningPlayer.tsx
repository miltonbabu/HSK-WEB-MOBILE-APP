import { useEffect, useRef, useState } from 'react'
import { Volume2, Loader2 } from 'lucide-react'

interface Props {
  text: string
  autoPlay?: boolean
  speed?: number
}

export default function ListeningPlayer({ text, autoPlay = true, speed = 1 }: Props) {
  const [playing, setPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const spokenRef = useRef(false)

  const speak = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = speed
    u.pitch = 1
    u.onend = () => setPlaying(false)
    u.onerror = () => setPlaying(false)
    setPlaying(true)
    window.speechSynthesis.speak(u)
  }

  // Auto-play once when the question first mounts.
  useEffect(() => {
    if (!autoPlay || spokenRef.current) return
    spokenRef.current = true
    setLoaded(true)
    // Small delay so the UI is painted before speech starts.
    const t = setTimeout(speak, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  if (!loaded && autoPlay) {
    return (
      <div className="flex items-center gap-2 text-ink-500 dark:text-ink-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Preparing audio...
      </div>
    )
  }

  return (
    <button
      onClick={speak}
      disabled={playing}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-70 text-white font-semibold text-sm transition-colors"
    >
      <Volume2 className="w-4 h-4" />
      {playing ? 'Playing...' : 'Replay audio'}
    </button>
  )
}
