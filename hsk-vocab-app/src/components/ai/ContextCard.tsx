import { X, MessageCircle, GraduationCap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConversationScenario } from '@/data/aiModes'
import { GrammarPattern } from '@/services/ai-chat'

interface ContextCardProps {
  scenario?: ConversationScenario
  pattern?: GrammarPattern
  onClear: () => void
}

export default function ContextCard({ scenario, pattern, onClear }: ContextCardProps) {
  return (
    <AnimatePresence mode="wait">
      {(scenario || pattern) && (
        <motion.div
          key={scenario?.id || pattern?.name || 'ctx'}
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div
            className="mx-3 sm:mx-4 mt-2 sm:mt-3 rounded-2xl border p-3 sm:p-3.5 flex items-start gap-2.5 sm:gap-3"
            style={{
              background:
                'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(236,72,153,0.06) 100%)',
              borderColor: 'rgba(139,92,246,0.25)',
            }}
          >
            {scenario ? (
              <>
                <div
                  className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(236,72,153,0.15) 100%)',
                  }}
                >
                  {scenario.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <MessageCircle className="w-3 h-3 text-purple-500" />
                    <span className="text-[10px] sm:text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                      Conversation · HSK {scenario.hskLevel}
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-ink-900 dark:text-white truncate">
                    {scenario.title}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-ink-500 dark:text-ink-400 line-clamp-2 mt-0.5">
                    {scenario.setting} · You are talking to {scenario.aiRole}.
                  </p>
                </div>
              </>
            ) : pattern ? (
              <>
                <div
                  className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(236,72,153,0.15) 100%)',
                  }}
                >
                  <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <GraduationCap className="w-3 h-3 text-purple-500" />
                    <span className="text-[10px] sm:text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                      Grammar · HSK {pattern.level}
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-ink-900 dark:text-white">
                    {pattern.name} <span className="text-ink-400 dark:text-ink-500 font-normal">· {pattern.nameEn}</span>
                  </h3>
                  <p className="text-[10px] sm:text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                    {pattern.structure}
                  </p>
                </div>
              </>
            ) : null}
            <button
              onClick={onClear}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
              aria-label="Clear context"
              title="End session"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
