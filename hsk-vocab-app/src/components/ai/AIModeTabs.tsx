import { motion } from 'framer-motion'
import { AI_MODES, AIMode } from '@/data/aiModes'
import { cn } from '@/utils/cn'

interface AIModeTabsProps {
  active: AIMode
  onChange: (mode: AIMode) => void
  className?: string
}

export default function AIModeTabs({ active, onChange, className }: AIModeTabsProps) {
  return (
    <div
      className={cn(
        'inline-flex p-1 rounded-2xl bg-ink-100/80 dark:bg-white/5 border border-ink-200/60 dark:border-white/10',
        className,
      )}
    >
      {AI_MODES.map((mode) => {
        const Icon = mode.icon
        const isActive = mode.id === active
        return (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors',
              isActive ? 'text-white' : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200',
            )}
            aria-label={mode.label}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <motion.span
                layoutId="ai-mode-active"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="relative w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="relative hidden sm:inline">{mode.label}</span>
            <span className="relative sm:hidden">{mode.shortLabel}</span>
          </button>
        )
      })}
    </div>
  )
}
