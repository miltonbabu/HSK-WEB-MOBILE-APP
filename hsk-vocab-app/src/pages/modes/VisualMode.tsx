import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProgressStore, useAuthStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, UserProgress } from '@/types'
import { getToneColor, splitPinyinSyllables } from '@/utils/pinyin'
import { updateWordProgress, recordStudySession } from '@/utils/study-helpers'
import { Pencil, Volume2, RotateCcw, Eye, EyeOff, Eraser, Shuffle, ArrowRight } from 'lucide-react'

export default function VisualMode() {
  const { selectedLevel } = useProgressStore()
  const { user } = useAuthStore()
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [isRandom, setIsRandom] = useState(false)
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const sessionStartRef = useRef(Date.now())
  const [wordsStudied, setWordsStudied] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const originalWords = useRef<Word[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const levelWords = await wordService.getByLevel(selectedLevel)
        originalWords.current = levelWords
        setWords(levelWords)
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')
        setProgress(new Map(userProgress.map((p) => [p.word_id, p])))
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [selectedLevel])

  useEffect(() => {
    return () => {
      if (wordsStudied > 0) {
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        recordStudySession(user?.id || 'guest', 'visual', wordsStudied, 0, duration)
      }
    }
  }, [])

  const currentWord = words[currentIndex]

  const speak = useCallback((chinese: string, wordId: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(chinese)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.8
    utterance.onend = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)
    setSpeakingId(wordId)
    window.speechSynthesis.speak(utterance)
  }, [])

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(2, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3
    ctx.strokeStyle = '#8b5cf6'
    ctxRef.current = ctx
    ctx.fillStyle = 'rgba(139,92,246,0.04)'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.strokeStyle = 'rgba(139,92,246,0.1)'
    ctx.lineWidth = 1
    const midX = rect.width / 2
    const midY = rect.height / 2
    ctx.beginPath()
    ctx.moveTo(midX, 0)
    ctx.lineTo(midX, rect.height)
    ctx.moveTo(0, midY)
    ctx.lineTo(rect.width, midY)
    ctx.stroke()
    ctx.strokeStyle = '#8b5cf6'
    ctx.lineWidth = 3
  }, [])

  useEffect(() => {
    if (showInfo) {
      setTimeout(initCanvas, 100)
    }
  }, [showInfo, currentIndex, initCanvas])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!ctxRef.current) return
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    let x: number, y: number
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }
    ctxRef.current.beginPath()
    ctxRef.current.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctxRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    let x: number, y: number
    if ('touches' in e) {
      e.preventDefault()
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }
    ctxRef.current.lineTo(x, y)
    ctxRef.current.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    initCanvas()
  }

  const toggleRandom = () => {
    if (isRandom) {
      setWords([...originalWords.current])
    } else {
      const shuffled = [...words]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      setWords(shuffled)
    }
    setIsRandom(!isRandom)
    setCurrentIndex(0)
    setShowInfo(false)
  }

  const goNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowInfo(false)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowInfo(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent" />
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Pencil className="w-16 h-16 text-ink-400 dark:text-ink-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-ink-900 dark:text-white">No Words Available</h2>
        <p className="text-ink-500 dark:text-ink-400 mt-2">No words found for HSK {selectedLevel}.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">Visual Learning</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">HSK {selectedLevel} • Card {currentIndex + 1}/{words.length}</p>
        </div>
        <button
          onClick={toggleRandom}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isRandom
              ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
              : 'pill-inactive'
          }`}
        >
          {isRandom ? <Shuffle className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          Random
        </button>
        <button
          onClick={() => currentWord && speak(currentWord.chinese, currentWord.id)}
          className={`p-2.5 rounded-xl transition-all ${
            speakingId === currentWord?.id
              ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/20'
              : 'text-ink-400 dark:text-ink-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
          }`}
        >
          <Volume2 className={`w-5 h-5 ${speakingId === currentWord?.id ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      <div className="h-2 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden backdrop-blur">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)' }}
          initial={{ width: `${(currentIndex / words.length) * 100}%` }}
          animate={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
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
          className="card py-6"
        >
          <div className="text-center">
            <div className="relative inline-block">
              <div className="min-w-36 min-h-36 sm:min-w-44 sm:min-h-44 px-6 py-4 rounded-2xl flex items-center justify-center mx-auto"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(236,72,153,0.08) 100%)',
                  border: '2px solid rgba(139,92,246,0.15)'
                }}>
                <span className="text-5xl sm:text-6xl font-bold text-ink-900 dark:text-white chinese-text whitespace-nowrap">
                  {currentWord?.chinese}
                </span>
              </div>
              {currentWord?.stroke_count > 0 && (
                <div className="absolute -top-2 -right-2 text-xs px-2 py-1 rounded-full text-white font-semibold"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', boxShadow: '0 4px 12px rgba(139,92,246,0.35)' }}>
                  {currentWord.stroke_count} strokes
                </div>
              )}
            </div>

            <div className="mt-5 text-2xl">
              {currentWord && splitPinyinSyllables(currentWord.pinyin).map(({ syllable, tone }, i) => (
                <span key={i} className={getToneColor(tone)}>
                  {syllable}{i < currentWord.pinyin.split(' ').length - 1 ? ' ' : ''}
                </span>
              ))}
            </div>

            <p className="mt-2 text-lg font-medium text-ink-800 dark:text-ink-200">{currentWord?.english}</p>
            <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
              {currentWord && (Array.isArray(currentWord.pos) ? currentWord.pos.join(' · ') : currentWord.pos)}
            </p>
          </div>

          <div className="mt-5">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                showInfo
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : 'pill-inactive'
              }`}
            >
              {showInfo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showInfo ? 'Hide Practice Area' : 'Practice Writing'}
            </button>
          </div>

          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-ink-500 dark:text-ink-400">Trace or write the character below</p>
                    <button
                      onClick={clearCanvas}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/30 dark:hover:bg-white/10 transition-all"
                    >
                      <Eraser className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden border-2 border-purple-200 dark:border-purple-800/50"
                    style={{ background: 'rgba(139,92,246,0.03)' }}>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                      <span className="text-[8rem] sm:text-[10rem] font-bold text-ink-900/[0.07] dark:text-white/[0.05] chinese-text">
                        {currentWord?.chinese}
                      </span>
                    </div>
                    <canvas
                      ref={canvasRef}
                      className="w-full touch-none cursor-crosshair"
                      style={{ height: '220px' }}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-ink-400 dark:text-ink-500">Reference:</span>
                    <span className="text-2xl font-bold text-ink-900 dark:text-white chinese-text">{currentWord?.chinese}</span>
                    <button
                      onClick={() => currentWord && speak(currentWord.chinese, currentWord.id)}
                      className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                if (currentWord) {
                  updateWordProgress(currentWord.id, 5, user?.id || 'guest', progress.get(currentWord.id) || null)
                  setWordsStudied(prev => prev + 1)
                  goNext()
                }
              }}
              disabled={currentIndex === words.length - 1}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-green-500 text-white shadow-lg shadow-green-500/30 hover:bg-green-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Know
            </button>
            <button
              onClick={() => {
                if (currentWord) {
                  updateWordProgress(currentWord.id, 2, user?.id || 'guest', progress.get(currentWord.id) || null)
                  setWordsStudied(prev => prev + 1)
                  goNext()
                }
              }}
              disabled={currentIndex === words.length - 1}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Still Learning
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            currentIndex === 0
              ? 'text-ink-300 dark:text-ink-600 cursor-not-allowed'
              : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/30 dark:hover:bg-white/10 active:scale-95'
          }`}
        >
          Previous
        </button>

        <button
          onClick={clearCanvas}
          className="p-2.5 rounded-xl text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/30 dark:hover:bg-white/10 transition-all active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={goNext}
          disabled={currentIndex === words.length - 1}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            currentIndex === words.length - 1
              ? 'text-ink-300 dark:text-ink-600 cursor-not-allowed'
              : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/30 dark:hover:bg-white/10 active:scale-95'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  )
}
