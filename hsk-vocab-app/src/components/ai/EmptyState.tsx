import { motion } from 'framer-motion'
import {
  BookOpen,
  GraduationCap,
  CalendarDays,
  Table2,
  GitBranch,
} from 'lucide-react'
import { AIMode, AIModeConfig, CONVERSATION_SCENARIOS, ConversationScenario } from '@/data/aiModes'
import { GrammarPattern } from '@/services/ai-chat'

interface EmptyStateProps {
  mode: AIMode
  modeConfig: AIModeConfig
  onSuggestion: (text: string) => void
  onScenario?: (scenario: ConversationScenario) => void
  onPattern?: (pattern: GrammarPattern) => void
  grammarPatterns?: GrammarPattern[]
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
}: EmptyStateProps) {
  const ModeIcon = modeConfig.icon

  if (mode === 'chat') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-6 sm:py-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-3 sm:mb-4"
          style={{
            background:
              'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(236,72,153,0.1) 100%)',
          }}
        >
          <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-purple-500" />
        </motion.div>
        <h2 className="text-base sm:text-lg font-bold text-ink-900 dark:text-white mb-1">
          {modeConfig.emptyTitle}
        </h2>
        <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400 max-w-sm mb-5 sm:mb-6">
          {modeConfig.emptySubtitle}
        </p>

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full max-w-md mb-4 sm:mb-5">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => onSuggestion(action.message)}
              className="flex flex-col items-center gap-1 px-2.5 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-medium bg-purple-50/80 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all border border-purple-200/50 dark:border-purple-700/30"
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
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium bg-ink-50 dark:bg-white/5 text-ink-600 dark:text-ink-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all border border-ink-100/50 dark:border-white/5"
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
      <div className="flex flex-col items-center h-full text-center px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-2 sm:mb-3"
          style={{
            background:
              'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(139,92,246,0.1) 100%)',
          }}
        >
          <ModeIcon className="w-6 h-6 sm:w-7 sm:h-7 text-pink-500" />
        </motion.div>
        <h2 className="text-base sm:text-lg font-bold text-ink-900 dark:text-white mb-1">
          {modeConfig.emptyTitle}
        </h2>
        <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400 max-w-sm mb-4 sm:mb-5">
          {modeConfig.emptySubtitle}
        </p>
        <div className="grid grid-cols-2 gap-2 w-full max-w-2xl pb-4">
          {CONVERSATION_SCENARIOS.map((s) => {
            return (
              <button
                key={s.id}
                onClick={() => onScenario?.(s)}
                className="group flex flex-col items-start gap-1.5 p-3 rounded-2xl text-left bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-ink-100/60 dark:border-white/10 hover:border-pink-300 dark:hover:border-pink-500/50 transition-all hover:shadow-sm"
              >
                <div className="flex items-center gap-2 w-full">
                  <div
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(139,92,246,0.08) 100%)',
                    }}
                  >
                    {s.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-xs sm:text-sm font-bold text-ink-900 dark:text-white truncate">
                        {s.title}
                      </h3>
                      <span className="text-[9px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 px-1.5 py-0.5 rounded shrink-0">
                        HSK {s.hskLevel}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] sm:text-[11px] text-ink-500 dark:text-ink-400 line-clamp-2 pl-0.5">
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
    <div className="flex flex-col items-center h-full text-center px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-2 sm:mb-3"
        style={{
          background:
            'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
        }}
      >
        <ModeIcon className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" />
      </motion.div>
      <h2 className="text-base sm:text-lg font-bold text-ink-900 dark:text-white mb-1">
        {modeConfig.emptyTitle}
      </h2>
      <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400 max-w-sm mb-4 sm:mb-5">
        {modeConfig.emptySubtitle}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl pb-4">
        {grammarPatterns.map((p) => (
          <button
            key={p.name}
            onClick={() => onPattern?.(p)}
            className="group flex flex-col items-start gap-1 p-3 rounded-2xl text-left bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-ink-100/60 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all hover:shadow-sm"
          >
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-bold text-ink-900 dark:text-white">
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
        ))}
      </div>
    </div>
  )
}
