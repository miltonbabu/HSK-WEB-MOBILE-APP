'use client'

interface Props {
  current: number
  total: number
  label: string
  onQuit?: () => void
}

export default function PracticeProgress({ current, total, label, onQuit }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-ink-500 dark:text-ink-400">
            {current} / {total}
          </span>
          {onQuit && (
            <button
              type="button"
              onClick={onQuit}
              className="text-xs text-ink-400 hover:text-red-500 transition-colors"
            >
              Quit
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#8b5cf6,#ec4899)' }}
        />
      </div>
    </div>
  )
}