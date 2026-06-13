import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, BookOpen, Flame, Trophy, Check, RotateCcw, GraduationCap, MessageCircle, Plane, Music, Briefcase, Ellipsis, Zap, Sparkles } from 'lucide-react'

interface OnboardingProps {
  onComplete: (data: { levels: number[]; dailyGoal: number; learningReason: string; createPlan: boolean }) => void
  onSkip: () => void
}

type LearningReason = 'hsk_exam' | 'conversation' | 'travel' | 'culture' | 'work' | 'other' | ''

const HSK_LEVELS = [
  { level: 0, label: 'Beginner', count: 0, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)' },
  { level: 1, label: 'HSK 1', count: 300, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)' },
  { level: 2, label: 'HSK 2', count: 300, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  { level: 3, label: 'HSK 3', count: 500, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  { level: 4, label: 'HSK 4', count: 1000, color: '#ec4899', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.3)' },
]

const DAILY_GOALS = [
  { value: 10, icon: Target, label: '10 words', sub: 'Casual', colors: ['#8b5cf6', '#7c3aed'], shadow: 'rgba(139,92,246,0.3)' },
  { value: 20, icon: BookOpen, label: '20 words', sub: 'Steady', colors: ['#34d399', '#14b8a6'], shadow: 'rgba(16,185,129,0.3)' },
  { value: 30, icon: Flame, label: '30 words', sub: 'Focused', colors: ['#fbbf24', '#f97316'], shadow: 'rgba(245,158,11,0.3)' },
  { value: 50, icon: Trophy, label: '50 words', sub: 'Intense', colors: ['#f472b6', '#f43f5e'], shadow: 'rgba(236,72,153,0.3)' },
]

const REASONS: { key: LearningReason; icon: any; label: string; desc: string; color: string }[] = [
  { key: 'hsk_exam', icon: GraduationCap, label: 'HSK Exam Prep', desc: 'Passing the HSK test', color: '#8b5cf6' },
  { key: 'conversation', icon: MessageCircle, label: 'Conversation', desc: 'Speaking with people', color: '#10b981' },
  { key: 'travel', icon: Plane, label: 'Travel', desc: 'Traveling in China', color: '#f59e0b' },
  { key: 'culture', icon: Music, label: 'Culture & Media', desc: 'Music, movies, shows', color: '#ec4899' },
  { key: 'work', icon: Briefcase, label: 'Work / Business', desc: 'Professional use', color: '#3b82f6' },
  { key: 'other', icon: Ellipsis, label: 'Other', desc: 'Personal interest', color: '#6b7280' },
]

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
}

export default function Onboarding({ onComplete, onSkip }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1])
  const [dailyGoal, setDailyGoal] = useState(20)
  const [learningReason, setLearningReason] = useState<LearningReason>('')
  const [createPlan, setCreatePlan] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const totalSteps = 4

  const toggleLevel = (level: number) => {
    if (level === 0) {
      setSelectedLevels([0])
      return
    }
    setSelectedLevels((prev) => {
      const filtered = prev.filter((l) => l !== 0)
      return filtered.includes(level)
        ? (filtered.length > 1 ? filtered.filter((l) => l !== level) : filtered)
        : [...filtered, level]
    })
  }

  const goNext = () => {
    if (step < totalSteps - 1) {
      setDirection(1)
      setStep(step + 1)
    } else {
      onComplete({ levels: selectedLevels, dailyGoal, learningReason, createPlan })
    }
  }

  const goBack = () => {
    if (step > 0) {
      setDirection(-1)
      setStep(step - 1)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card w-full max-w-lg overflow-hidden"
        style={{ maxHeight: '90vh' }}
      >
        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          <AnimatePresence mode="wait" custom={direction}>
            {/* Step 1: Welcome + Select Level */}
            {step === 0 && (
              <motion.div
                key="step-0"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold gradient-text">Welcome to My HSK!</h1>
                  <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Let's set up your learning journey</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {HSK_LEVELS.map((l) => {
                    const selected = selectedLevels.includes(l.level)
                    return (
                      <button
                        key={l.level}
                        onClick={() => toggleLevel(l.level)}
                        className="relative rounded-2xl p-4 text-left transition-all duration-200"
                        style={{
                          background: selected ? l.bg : 'rgba(225,226,230,0.15)',
                          border: `2px solid ${selected ? l.color : 'transparent'}`,
                          boxShadow: selected ? `0 4px 15px ${l.border}` : 'none',
                        }}
                      >
                        {selected && (
                          <div
                            className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: l.color }}
                          >
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div
                          className="text-lg font-bold mb-1"
                          style={{ color: selected ? l.color : undefined }}
                        >
                          {l.label}
                        </div>
                        <div className="text-sm text-ink-500 dark:text-ink-400">{l.count} words</div>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 2: Set Daily Goal */}
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold gradient-text">Set Your Daily Goal</h1>
                  <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">How many words do you want to study each day?</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {DAILY_GOALS.map((g) => {
                    const selected = dailyGoal === g.value
                    return (
                      <button
                        key={g.value}
                        onClick={() => setDailyGoal(g.value)}
                        className="relative rounded-2xl p-4 text-center transition-all duration-200"
                        style={{
                          background: selected
                            ? `linear-gradient(135deg, ${g.colors[0]}15 0%, ${g.colors[1]}10 100%)`
                            : 'rgba(225,226,230,0.15)',
                          border: `2px solid ${selected ? g.colors[0] : 'transparent'}`,
                          boxShadow: selected ? `0 4px 15px ${g.shadow}` : 'none',
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-2"
                          style={{
                            background: `linear-gradient(135deg, ${g.colors[0]} 0%, ${g.colors[1]} 100%)`,
                            boxShadow: selected ? `0 4px 12px ${g.shadow}` : 'none',
                            opacity: selected ? 1 : 0.6,
                          }}
                        >
                          <g.icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-lg font-bold text-ink-900 dark:text-white">{g.label}</div>
                        <div className="text-xs text-ink-500 dark:text-ink-400">{g.sub}</div>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 2: Learning Reason */}
            {step === 2 && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold gradient-text">Why Are You Learning?</h1>
                  <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">This helps us tailor your study experience.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {REASONS.map((r) => {
                    const selected = learningReason === r.key
                    const Icon = r.icon
                    return (
                      <button
                        key={r.key}
                        onClick={() => setLearningReason(r.key)}
                        className="relative rounded-2xl p-4 text-left transition-all duration-200"
                        style={{
                          background: selected ? `${r.color}10` : 'rgba(225,226,230,0.15)',
                          border: `2px solid ${selected ? r.color : 'transparent'}`,
                          boxShadow: selected ? `0 4px 15px ${r.color}30` : 'none',
                        }}
                      >
                        {selected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: r.color }}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: selected ? r.color : 'rgba(100,116,139,0.15)' }}>
                          <Icon className="w-4 h-4" style={{ color: selected ? 'white' : '#94a3b8' }} />
                        </div>
                        <div className="text-sm font-bold" style={{ color: selected ? r.color : undefined }}>{r.label}</div>
                        <div className="text-xs text-ink-500 dark:text-ink-400">{r.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 3: Personalized Plan */}
            {step === 3 && (
              <motion.div
                key="step-3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.1))' }}>
                    <Sparkles className="w-7 h-7" style={{ color: '#8b5cf6' }} />
                  </div>
                  <h1 className="text-2xl font-bold gradient-text">Personalized Plan</h1>
                  <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Let AI create a study plan just for you?</p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => setCreatePlan(true)}
                    className="w-full rounded-2xl p-4 text-left transition-all duration-200"
                    style={{
                      background: createPlan ? 'rgba(139,92,246,0.1)' : 'rgba(225,226,230,0.15)',
                      border: `2px solid ${createPlan ? '#8b5cf6' : 'transparent'}`,
                      boxShadow: createPlan ? '0 4px 15px rgba(139,92,246,0.2)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: createPlan ? '#8b5cf6' : 'rgba(100,116,139,0.15)' }}>
                        <Zap className="w-5 h-5" style={{ color: createPlan ? 'white' : '#94a3b8' }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-ink-900 dark:text-white">Yes, create a plan</div>
                        <div className="text-xs text-ink-500 dark:text-ink-400">Daily tips, level-appropriate content, AI guidance</div>
                      </div>
                      {createPlan && <Check className="w-5 h-5" style={{ color: '#8b5cf6' }} />}
                    </div>
                  </button>
                  <button
                    onClick={() => setCreatePlan(false)}
                    className="w-full rounded-2xl p-4 text-left transition-all duration-200"
                    style={{
                      background: !createPlan ? 'rgba(225,226,230,0.15)' : 'rgba(225,226,230,0.08)',
                      border: `2px solid ${!createPlan ? '#cbd5e1' : 'transparent'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: !createPlan ? '#64748b' : 'rgba(100,116,139,0.15)' }}>
                        <Target className="w-5 h-5" style={{ color: !createPlan ? 'white' : '#94a3b8' }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-ink-900 dark:text-white">I'll explore on my own</div>
                        <div className="text-xs text-ink-500 dark:text-ink-400">Browse freely, learn at your own pace</div>
                      </div>
                      {!createPlan && <Check className="w-5 h-5" style={{ color: '#64748b' }} />}
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Try a Flashcard */}
            {step === 4 && (
              <motion.div
                key="step-4"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold gradient-text">Try a Flashcard!</h1>
                  <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Here's how learning works</p>
                </div>
                <div className="flex justify-center mb-4">
                  <div
                    className="w-full max-w-xs cursor-pointer"
                    style={{ perspective: 600 }}
                    onClick={() => setFlipped(!flipped)}
                  >
                    <motion.div
                      animate={{ rotateY: flipped ? 180 : 0 }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                      style={{ transformStyle: 'preserve-3d' }}
                      className="relative w-full"
                    >
                      {/* Front */}
                      <div
                        className="rounded-2xl p-8 text-center"
                        style={{
                          backfaceVisibility: 'hidden',
                          background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(236,72,153,0.08) 100%)',
                          border: '1px solid rgba(139,92,246,0.2)',
                        }}
                      >
                        <p className="text-5xl font-bold chinese-text mb-3 text-ink-900 dark:text-white">你好</p>
                        <p className="text-lg text-ink-500 dark:text-ink-400">nǐ hǎo</p>
                        <p className="mt-3 text-xs text-ink-400 dark:text-ink-500 flex items-center justify-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Tap to flip
                        </p>
                      </div>
                      {/* Back */}
                      <div
                        className="absolute inset-0 rounded-2xl p-8 text-center"
                        style={{
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                          background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(52,211,153,0.08) 100%)',
                          border: '1px solid rgba(16,185,129,0.2)',
                        }}
                      >
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">hello</p>
                        <p className="text-2xl chinese-text text-ink-700 dark:text-ink-300">你好</p>
                        <p className="text-sm text-ink-400 dark:text-ink-500 mt-1">nǐ hǎo</p>
                      </div>
                    </motion.div>
                  </div>
                </div>
                {flipped && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center"
                  >
                    <button
                      onClick={goNext}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                        boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                      }}
                    >
                      Got it!
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ink-100/50 dark:border-ink-700/50 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-sm text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 20 : 8,
                  height: 8,
                  background: i === step
                    ? 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)'
                    : 'rgba(225,226,230,0.5)',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={goBack}
                className="text-sm text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors"
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={goNext}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
                }}
              >
                Next
              </button>
            ) : (
              <button
                onClick={goNext}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                  boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                }}
              >
                Start Learning!
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
