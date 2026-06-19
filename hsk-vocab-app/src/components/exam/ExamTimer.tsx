import { useEffect, useRef, useState } from 'react'

interface Props {
  durationSec: number
  onExpire: () => void
  paused?: boolean
}

export default function ExamTimer({ durationSec, onExpire, paused }: Props) {
  const [remaining, setRemaining] = useState(durationSec)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (paused) return
    if (remaining <= 0) {
      onExpireRef.current()
      return
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, paused])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const low = remaining < 60

  return (
    <span
      className={`font-mono font-bold tabular-nums text-sm px-2.5 py-1 rounded-lg ${
        low
          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 animate-pulse'
          : 'bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-200'
      }`}
    >
      {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
    </span>
  )
}
