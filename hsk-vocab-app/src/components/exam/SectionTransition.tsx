import { motion } from 'framer-motion'
import { Headphones, BookOpen, PenTool, Loader2, AlertCircle, Home } from 'lucide-react'
import { ExamSectionId, GenerateProgress } from '@/types/exam'

interface Props {
  nextSectionId: ExamSectionId
  progress: GenerateProgress | null
  error: string | null
  onRetake: () => void
}

const SECTION_META: Record<ExamSectionId, { name: string; nameCn: string; Icon: typeof Headphones; gradient: string }> = {
  listening: { name: 'Listening', nameCn: '听力', Icon: Headphones, gradient: 'from-red-500 to-red-600' },
  reading: { name: 'Reading', nameCn: '阅读', Icon: BookOpen, gradient: 'from-blue-500 to-blue-600' },
  writing: { name: 'Writing', nameCn: '书写', Icon: PenTool, gradient: 'from-amber-500 to-amber-600' },
}

export default function SectionTransition({ nextSectionId, progress, error, onRetake }: Props) {
  const meta = SECTION_META[nextSectionId]
  const Icon = meta.Icon
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 5

  return (
    <div className="max-w-md mx-auto space-y-5 py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 text-center space-y-4"
      >
        <div className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink-900 dark:text-white">
            {error ? 'Could not load next section' : 'Loading next section…'}
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
            Next: <span className="font-semibold text-ink-700 dark:text-ink-200">{meta.name}</span>{' '}
            <span className="chinese-text text-ink-400">· {meta.nameCn}</span>
          </p>
        </div>

        {error ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button onClick={onRetake} className="btn-secondary w-full flex items-center justify-center gap-2">
              <Home className="w-4 h-4" />
              Back to exam setup
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-700 dark:text-ink-200">
              {progress?.message || 'Preparing next section…'}
            </p>
            <div className="h-2 rounded-full bg-ink-200 dark:bg-ink-700 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-red-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[11px] text-ink-500 dark:text-ink-400 flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              This usually takes a few seconds
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
