import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore, useProgressStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, UserProgress, HSKLevel } from '@/types'
import { updateWordProgress, recordStudySession } from '@/utils/study-helpers'
import { PenTool, Eraser, Eye, Check, X, RotateCcw, Sparkles, Loader2 } from 'lucide-react'
import { evaluateHandwriting, HandwritingFeedback } from '@/services/ai-features'

const WORD_COUNTS = [5, 10, 15, 20]
const LEVEL_OPTIONS: (HSKLevel | 'all')[] = [1, 2, 3, 4, 'all']

type Phase = 'setup' | 'practice' | 'result'

export default function HandwritingMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const navigate = useNavigate()

  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('setup')
  const [selectedHSKLevel, setSelectedHSKLevel] = useState<HSKLevel | 'all'>(selectedLevel)
  const [wordCount, setWordCount] = useState(10)

  const [practiceWords, setPracticeWords] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [retriedCount, setRetriedCount] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const [aiFeedback, setAiFeedback] = useState<HandwritingFeedback | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const sessionStartRef = useRef(Date.now())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const allWords = await wordService.getAll()
        setWords(allWords)
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')
        setProgress(new Map(userProgress.map((p) => [p.word_id, p])))
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const filteredWords =
    selectedHSKLevel === 'all'
      ? words
      : words.filter((w) => w.hsk_level === selectedHSKLevel)

  const startPractice = () => {
    const shuffled = shuffleArray(filteredWords)
    const selected = shuffled.slice(0, Math.min(wordCount, shuffled.length))
    setPracticeWords(selected)
    setCurrentIndex(0)
    setCompletedCount(0)
    setRetriedCount(0)
    setShowHint(false)
    sessionStartRef.current = Date.now()
    setPhase('practice')
  }

  // Canvas setup
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const size = Math.min(rect.width, 400)
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 4
    ctx.strokeStyle = '#333333'
  }, [])

  useEffect(() => {
    if (phase !== 'practice') return
    setupCanvas()

    const handleResize = () => setupCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [phase, currentIndex, setupCanvas])

  // Draw hint on canvas
  useEffect(() => {
    if (phase !== 'practice') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (showHint && currentWord) {
      ctx.save()
      ctx.font = '120px serif'
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(currentWord.chinese, canvas.width / 2, canvas.height / 2)
      ctx.restore()
    }
  }, [phase, showHint, currentIndex])

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const handleDrawStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    isDrawingRef.current = true
    const { x, y } = getCanvasPoint(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handleDrawMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCanvasPoint(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const handleDrawEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDrawingRef.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 4
    ctx.strokeStyle = '#333333'

    if (showHint && currentWord) {
      ctx.save()
      ctx.font = '120px serif'
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(currentWord.chinese, canvas.width / 2, canvas.height / 2)
      ctx.restore()
    }
  }

  const handleLooksGood = async () => {
    if (!currentWord) return
    const existingProgress = progress.get(currentWord.id)
    await updateWordProgress(currentWord.id, 5, user?.id || 'guest', existingProgress || null)
    setCompletedCount((prev) => prev + 1)

    // Get AI handwriting feedback
    if (!aiFeedback) {
      setAiLoading(true)
      try {
        const feedback = await evaluateHandwriting(
          currentWord,
          `User drew the character ${currentWord.chinese}`,
          null,
        )
        setAiFeedback(feedback)
      } catch {
        // feedback optional
      } finally {
        setAiLoading(false)
      }
      return // wait for user to see feedback before advancing
    }

    // Move to next word after feedback shown
    setAiFeedback(null)
    if (currentIndex < practiceWords.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setShowHint(false)
    } else {
      endSession()
    }
  }

  const handleTryAgain = () => {
    setRetriedCount((prev) => prev + 1)
    clearCanvas()
    setShowHint(false)
  }

  const endSession = () => {
    setPhase('result')
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const total = completedCount + retriedCount
    const accuracy = total > 0 ? Math.round((completedCount / total) * 100) : 0
    recordStudySession(user?.id || 'guest', 'handwriting', completedCount, accuracy, duration)
  }

  const currentWord = practiceWords[currentIndex]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-pink-500 border-t-transparent" />
      </div>
    )
  }

  if (filteredWords.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <PenTool className="w-16 h-16 text-ink-400 dark:text-ink-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-ink-900 dark:text-white">No Words Available</h2>
        <p className="text-ink-500 dark:text-ink-400 mt-2">
          No words found for the selected level. Try a different HSK level.
        </p>
      </div>
    )
  }

  // Setup Phase
  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
              boxShadow: '0 8px 25px rgba(236,72,153,0.35)',
            }}
          >
            <PenTool className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Handwriting Practice</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-2">
            Practice writing Chinese characters by hand. Draw each character on the canvas.
          </p>
        </div>

        <div className="card space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">HSK Level</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {LEVEL_OPTIONS.map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedHSKLevel(level)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    selectedHSKLevel === level ? 'pill-active' : 'pill-inactive'
                  }`}
                >
                  {level === 'all' ? 'All' : `HSK ${level}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Number of Words</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {WORD_COUNTS.map((count) => (
                <button
                  key={count}
                  onClick={() => setWordCount(count)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    wordCount === count ? 'pill-active' : 'pill-inactive'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-ink-500 dark:text-ink-400">
            <span>{filteredWords.length} words available</span>
          </div>

          <button
            onClick={startPractice}
            disabled={filteredWords.length === 0}
            className="btn-primary w-full py-3 text-lg"
          >
            Start Practice
          </button>
        </div>
      </div>
    )
  }

  // Result Phase
  if (phase === 'result') {
    const total = completedCount + retriedCount
    const accuracy = total > 0 ? Math.round((completedCount / total) * 100) : 0
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div
          className="card text-center py-8 space-y-4"
          style={{
            background:
              'linear-gradient(135deg, rgba(236,72,153,0.08) 0%, rgba(219,39,119,0.08) 100%)',
          }}
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
              boxShadow: '0 8px 25px rgba(236,72,153,0.35)',
            }}
          >
            <PenTool className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-ink-900 dark:text-white">Practice Complete!</h2>

          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="text-center">
              <p className="text-2xl font-bold gradient-text">{completedCount}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-ink-900 dark:text-white">{retriedCount}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Retried</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-ink-900 dark:text-white">{accuracy}%</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Accuracy</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-ink-500 dark:text-ink-400">
            <span>
              Time: {minutes > 0 ? `${minutes}m ` : ''}
              {seconds}s
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setPhase('setup')
              setCompletedCount(0)
              setRetriedCount(0)
            }}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
          <button
            onClick={() => navigate('/learn')}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            Back to Learn
          </button>
        </div>
      </div>
    )
  }

  // Practice Phase
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">Handwriting Practice</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Word {currentIndex + 1}/{practiceWords.length}
          </p>
        </div>
        <button
          onClick={() => navigate('/learn')}
          className="p-2 rounded-xl text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/30 dark:hover:bg-white/10 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="h-2 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden backdrop-blur">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #ec4899 0%, #db2777 100%)' }}
          animate={{ width: `${((currentIndex + 1) / practiceWords.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentWord?.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className="card text-center py-6">
            <p className="text-6xl sm:text-7xl font-bold text-ink-900 dark:text-white chinese-text">
              {currentWord?.chinese}
            </p>
            <p className="mt-3 text-xl font-semibold text-ink-700 dark:text-ink-300">
              {currentWord?.pinyin}
            </p>
            <p className="mt-1 text-base text-ink-500 dark:text-ink-400">{currentWord?.english}</p>
            {(currentWord?.radical || currentWord?.stroke_count) && (
              <div className="flex items-center justify-center gap-3 mt-3 text-xs text-ink-400 dark:text-ink-500">
                {currentWord?.radical && (
                  <span className="px-2.5 py-1 rounded-lg bg-ink-100/50 dark:bg-ink-700/50">
                    Radical: {currentWord.radical}
                  </span>
                )}
                {currentWord?.stroke_count > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-ink-100/50 dark:bg-ink-700/50">
                    Strokes: {currentWord.stroke_count}
                  </span>
                )}
              </div>
            )}
          </div>

          <div ref={containerRef} className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="border-2 border-ink-200 dark:border-ink-600 rounded-2xl touch-none cursor-crosshair"
              style={{ maxWidth: '400px', maxHeight: '400px' }}
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawEnd}
              onTouchStart={handleDrawStart}
              onTouchMove={handleDrawMove}
              onTouchEnd={handleDrawEnd}
            />
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={clearCanvas}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold pill-inactive transition-all"
            >
              <Eraser className="w-4 h-4" /> Clear
            </button>
            <button
              onClick={() => setShowHint((prev) => !prev)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                showHint ? 'pill-active' : 'pill-inactive'
              }`}
            >
              <Eye className="w-4 h-4" /> {showHint ? 'Hide Hint' : 'Show Hint'}
            </button>
          </div>

          {/* AI Handwriting Feedback */}
          <AnimatePresence>
            {aiFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card p-4 space-y-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(236,72,153,0.04) 100%)',
                  border: '1px solid rgba(139,92,246,0.15)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-semibold text-ink-900 dark:text-white">AI Feedback</span>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    Score: {aiFeedback.score}/5
                  </span>
                </div>
                <p className="text-sm text-ink-600 dark:text-ink-300">{aiFeedback.feedback}</p>
                {aiFeedback.structureIssues.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">Structure Issues:</p>
                    <ul className="list-disc list-inside text-xs text-ink-600 dark:text-ink-300 space-y-0.5">
                      {aiFeedback.structureIssues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiFeedback.strokeOrder && (
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    <span className="font-semibold">Stroke Order:</span> {aiFeedback.strokeOrder}
                  </p>
                )}
                {aiFeedback.tips.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">Tips:</p>
                    <ul className="list-disc list-inside text-xs text-purple-600 dark:text-purple-400 space-y-0.5">
                      {aiFeedback.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleTryAgain}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 4px 15px rgba(239,68,68,0.3)',
              }}
            >
              <RotateCcw className="w-4 h-4" /> Try Again
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLooksGood}
              disabled={aiLoading}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
              style={{
                background: aiFeedback ? 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: aiFeedback ? '0 4px 15px rgba(139,92,246,0.3)' : '0 4px 15px rgba(16,185,129,0.3)',
              }}
            >
              {aiLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : aiFeedback ? (
                <><Check className="w-4 h-4" /> Next Word</>
              ) : (
                <><Check className="w-4 h-4" /> Looks Good</>
              )}
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
