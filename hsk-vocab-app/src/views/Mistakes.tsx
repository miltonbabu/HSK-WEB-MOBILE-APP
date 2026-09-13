'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores'
import { Mistake, Skill } from '@/types/learning'
import { listMistakes, markMastered, markCorrect, removeMistake } from '@/services/mistakes.service'

const SKILLS: Skill[] = ['vocabulary', 'reading', 'listening', 'writing', 'speaking']

export default function Mistakes() {
  const { user } = useAuthStore()
  const userId = user?.id || 'guest'

  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [loading, setLoading] = useState(true)
  const [skillFilter, setSkillFilter] = useState<Skill | 'all'>('all')
  const [showMastered, setShowMastered] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMistakes(await listMistakes(userId))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    return mistakes.filter((m) => {
      if (skillFilter !== 'all' && m.skill !== skillFilter) return false
      if (!showMastered && m.mastered) return false
      return true
    })
  }, [mistakes, skillFilter, showMastered])

  const availableSkills = useMemo(() => {
    const s = new Set(mistakes.map((m) => m.skill))
    return SKILLS.filter((k) => s.has(k))
  }, [mistakes])

  const unmasteredCount = mistakes.filter((m) => !m.mastered).length

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="pt-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Mistake Notebook
        </h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {unmasteredCount} open mistake{unmasteredCount === 1 ? '' : 's'} · review to lock them in
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSkillFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            skillFilter === 'all'
              ? 'bg-red-500 text-white'
              : 'bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300'
          }`}
        >
          All
        </button>
        {availableSkills.map((s) => (
          <button
            key={s}
            onClick={() => setSkillFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
              skillFilter === s
                ? 'bg-red-500 text-white'
                : 'bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300'
            }`}
          >
            {s}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-ink-600 dark:text-ink-300">
          <input
            type="checkbox"
            checked={showMastered}
            onChange={(e) => setShowMastered(e.target.checked)}
            className="accent-red-500"
          />
          Show mastered
        </label>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 text-sm font-semibold text-ink-700 dark:text-ink-200">No mistakes here</p>
          <p className="text-xs text-ink-500 dark:text-ink-400">Wrong answers from practice will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={`card p-4 ${m.mastered ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-300">
                      {m.skill}
                    </span>
                    {m.mastered && (
                      <span className="text-[10px] font-bold text-green-600 dark:text-green-400">MASTERED</span>
                    )}
                  </div>
                  {m.prompt && (
                    <p className="text-sm font-semibold text-ink-900 dark:text-white">{m.prompt}</p>
                  )}
                  <div className="text-sm space-y-0.5">
                    <p className="text-red-600 dark:text-red-400">
                      <span className="font-semibold">Your answer:</span> {m.user_answer}
                    </p>
                    <p className="text-green-700 dark:text-green-400">
                      <span className="font-semibold">Correct:</span> {m.correct_answer}
                    </p>
                  </div>
                  {m.explanation && (
                    <p className="text-xs text-ink-500 dark:text-ink-400">{m.explanation}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {!m.mastered ? (
                    <button
                      onClick={() => markCorrect(m.id, userId, m.word_id).then(() => load())}
                      className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                      title="Mark as mastered"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => markMastered(m.id, false).then(() => load())}
                      className="p-2 rounded-lg bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200"
                      title="Reopen"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => removeMistake(m.id).then(() => load())}
                    className="p-2 rounded-lg bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>
  )
}