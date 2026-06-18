import { motion } from 'framer-motion'
import {
  BookOpen,
  GraduationCap,
  CalendarDays,
  Table2,
  GitBranch,
  Check,
} from 'lucide-react'
import { AIMode, AIModeConfig } from '@/data/aiModes'
import { CONVERSATION_SCENARIOS, ConversationScenario } from '@/data/conversationScenarios'
import { GrammarPattern } from '@/services/ai-chat'

interface EmptyStateProps {
  mode: AIMode
  modeConfig: AIModeConfig
  onSuggestion: (text: string) => void
  onScenario?: (scenario: ConversationScenario) => void
  onPattern?: (pattern: GrammarPattern) => void
  grammarPatterns?: GrammarPattern[]
  selectedScenarioId?: string | null
  selectedPatternName?: string | null
}

const quickActions = [
  { label: 'Grammar Help', icon: GraduationCap, message: 'Explain common HSK grammar patterns with examples' },
  { label: 'Study Plan', icon: CalendarDays, message: 'Create a personalized study plan for me based on my progress' },
  { label: 'Vocabulary Table', icon: Table2, message: 'Show me a table comparing the key HSK vocabulary words organized by level with their meaning and part of speech. Include pinyin. Please use a proper markdown table with columns: Chinese, Pinyin, Meaning, Part of Speech, HSK Level' },
  { label: 'Learning Flow Chart', icon: GitBranch, message: 'Create a flow chart showing the best order to learn Chinese from absolute beginner through HSK 4. Show the key milestones along the path. Use a mermaid flowchart.' },
]

const suggestions = [
  'What does 安排 mean?',
  'Show me HSK 4 verbs',
  'Give me a quiz',
  'How do you say important?',
]

export default function EmptyState({
  mode,
  modeConfig,
  onSuggestion,
  onScenario,
  onPattern,
  grammarPatterns = [],
  selectedScenarioId = null,
  selectedPatternName = null,
}: EmptyStateProps) {
  const ModeIcon = modeConfig.icon

  if (mode === 'chat') {
    return (
      <div className="flex flex-col items-center justify-start text-center px-4 py-4 sm:py-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-3"
          style={{
            background:
              'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(236,72,153,0.1) 100%)',
          }}
        >
          <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
        </motion.div>
        <h2 className="text-sm sm:text-base font-bold text-ink-900 dark:text-white mb-1">
          {modeConfig.emptyTitle}
        </h2>
        <p className="text-[11px] sm:text-xs text-ink-500 dark:text-ink-400 max-w-sm mb-4">
          {modeConfig.emptySubtitle}
        </p>

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full max-w-md mb-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => onSuggestion(action.message)}
              className="flex flex-col items-center gap-1 px-2.5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-medium bg-red-50/80 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all border border-red-200/50 dark:border-red-700/30"
            >
              <action.icon className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
              <span className="text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center max-w-md">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-medium bg-ink-50 dark:bg-white/5 text-ink-600 dark:text-ink-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all border border-ink-100/50 dark:border-white/5"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (mode === 'conversation') {
    return (
      <div className="flex flex-col items-center text-center px-3 sm:px-4 py-3 sm:py-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-2"
          style={{
            background:
              'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(139,92,246,0.1) 100%)',
          }}
        >
          <ModeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
        </motion.div>
        <h2 className="text-sm sm:text-base font-bold text-ink-900 dark:text-white mb-1">
          {modeConfig.emptyTitle}
        </h2>
        <p className="text-[11px] sm:text-xs text-ink-500 dark:text-ink-400 max-w-sm mb-3">
          {modeConfig.emptySubtitle}
        </p>
        <div className="grid grid-cols-2 gap-2 w-full max-w-2xl">
          {CONVERSATION_SCENARIOS.map((s) => {
            const isSelected = s.id === selectedScenarioId
            return (
              <button
                key={s.id}
                onClick={() => onScenario?.(s)}
                className={`group relative flex flex-col items-start gap-1.5 p-2.5 sm:p-3 rounded-2xl text-left transition-all hover:shadow-sm ${
                  isSelected
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-500 shadow-md'
                    : 'bg-white/70 dark:bg-white/5 border border-ink-100/60 dark:border-white/10 hover:border-amber-300 dark:hover:border-amber-500/50'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
                <div className="flex items-center gap-2 w-full">
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0"
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(236,72,153,0.25) 0%, rgba(139,92,246,0.18) 100%)'
                        : 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(139,92,246,0.08) 100%)',
                    }}
                  >
                    {s.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-[11px] sm:text-xs font-bold text-ink-900 dark:text-white truncate">
                        {s.title}
                      </h3>
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded shrink-0">
                        HSK {s.hskLevel}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-ink-500 dark:text-ink-400 line-clamp-2 pl-0.5">
                  {s.setting}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // grammar
  return (
    <div className="flex flex-col items-center text-center px-3 sm:px-4 py-3 sm:py-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-2"
        style={{
          background:
            'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
        }}
      >
        <ModeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
      </motion.div>
      <h2 className="text-sm sm:text-base font-bold text-ink-900 dark:text-white mb-1">
        {modeConfig.emptyTitle}
      </h2>
      <p className="text-[11px] sm:text-xs text-ink-500 dark:text-ink-400 max-w-sm mb-3">
        {modeConfig.emptySubtitle}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
        {grammarPatterns.map((p) => {
          const isSelected = p.name === selectedPatternName
          return (
            <button
              key={p.name}
              onClick={() => onPattern?.(p)}
              className={`group relative flex flex-col items-start gap-1 p-2.5 sm:p-3 rounded-2xl text-left transition-all hover:shadow-sm ${
                isSelected
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-400 dark:border-indigo-500 shadow-md'
                  : 'bg-white/70 dark:bg-white/5 border border-ink-100/60 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
              )}
              <div className="flex items-center justify-between w-full">
                <h3 className="text-xs sm:text-sm font-bold text-ink-900 dark:text-white">
                  {p.name}
                </h3>
                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">
                  HSK {p.level}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-ink-500 dark:text-ink-400 italic">
                {p.nameEn}
              </p>
              <p className="text-[10px] sm:text-xs text-ink-600 dark:text-ink-300 font-mono mt-0.5">
                {p.structure}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
