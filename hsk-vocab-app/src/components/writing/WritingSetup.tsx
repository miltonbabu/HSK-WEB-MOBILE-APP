'use client'

import { Loader2, PenLine } from 'lucide-react'
import { HSKLevel } from '@/types'
import { SentenceDifficulty, WritingDirection, WritingSettings } from '@/types/writing'

interface Props {
  settings: WritingSettings
  onChange: (patch: Partial<WritingSettings>) => void
  onStart: () => void
  loading: boolean
  error: string | null
}

const LEVELS: HSKLevel[] = [1, 2, 3, 4]

const DIRECTIONS: { id: WritingDirection; label: string }[] = [
  { id: 'en-pinyin', label: 'English + Pinyin → Chinese' },
  { id: 'pinyin', label: 'Pinyin → Chinese' },
  { id: 'en', label: 'English → Chinese' },
  { id: 'zh-pinyin', label: 'Chinese + Pinyin → Chinese' },
  { id: 'zh', label: 'Chinese → Chinese' },
  { id: 'sentence', label: 'Sentence Writing' },
]

const COUNTS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 0, label: 'All' },
]

const DIFFICULTIES: { id: SentenceDifficulty; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'medium', label: 'Medium' },
  { id: 'long', label: 'Long' },
]

export default function WritingSetup({ settings, onChange, onStart, loading, error }: Props) {
  const isSentence = settings.direction === 'sentence'

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <PenLine className="w-6 h-6 text-red-500" />
          Chinese Writing Practice
        </h1>
        <p className="mt-1 text-sm chinese-text text-ink-500 dark:text-ink-400">汉字书写练习</p>
      </div>

      <Section title="HSK Level">
        <div className="grid grid-cols-4 gap-2">
          {LEVELS.map((level) => (
            <Pill
              key={level}
              active={settings.hskLevel === level}
              onClick={() => onChange({ hskLevel: level, scope: level === 1 ? 'level' : settings.scope })}
            >
              HSK {level}
            </Pill>
          ))}
        </div>
      </Section>

      {settings.hskLevel > 1 && (
        <Section title="Scope">
          <div className="grid grid-cols-2 gap-2">
            <Pill active={settings.scope === 'level'} onClick={() => onChange({ scope: 'level' })}>
              Selected level
            </Pill>
            <Pill active={settings.scope === 'cumulative'} onClick={() => onChange({ scope: 'cumulative' })}>
              Cumulative 1–{settings.hskLevel}
            </Pill>
          </div>
        </Section>
      )}

      <Section title="Practice Type">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DIRECTIONS.map((direction) => (
            <Pill
              key={direction.id}
              active={settings.direction === direction.id}
              onClick={() => onChange({ direction: direction.id })}
            >
              {direction.label}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Order">
        <div className="grid grid-cols-2 gap-2">
          <Pill active={settings.order === 'sequential'} onClick={() => onChange({ order: 'sequential' })}>
            Sequential
          </Pill>
          <Pill active={settings.order === 'random'} onClick={() => onChange({ order: 'random' })}>
            Random
          </Pill>
        </div>
      </Section>

      <Section title="Questions">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {COUNTS.map((count) => (
            <Pill
              key={count.value}
              active={settings.questionCount === count.value}
              onClick={() => onChange({ questionCount: count.value })}
            >
              {count.label}
            </Pill>
          ))}
        </div>
      </Section>

      {isSentence && (
        <Section title="Difficulty">
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((difficulty) => (
              <Pill
                key={difficulty.id}
                active={settings.difficulty === difficulty.id}
                onClick={() => onChange({ difficulty: difficulty.id })}
              >
                {difficulty.label}
              </Pill>
            ))}
          </div>
        </Section>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button onClick={onStart} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? 'Preparing…' : 'Start Practice'}
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500 mb-2">{title}</p>
      {children}
    </div>
  )
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
        active
          ? 'text-white border-transparent'
          : 'bg-white dark:bg-ink-800 border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:border-red-300'
      }`}
      style={active ? { background: 'linear-gradient(135deg,#8b5cf6,#ec4899)' } : undefined}
    >
      {children}
    </button>
  )
}