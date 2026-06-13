import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProgressStore, useAuthStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { validateSentenceWithAI, SentenceValidation } from '@/services/ai-chat'
import { Word, UserProgress } from '@/types'
import { updateWordProgress, recordStudySession } from '@/utils/study-helpers'
import { Sparkles, CheckCircle2, XCircle, Lightbulb, ArrowRight, ArrowLeft, Volume2, Loader2, MessageSquare, RotateCcw } from 'lucide-react'

export default function SentenceMakingMode() {
  const { selectedLevel, currentWordIndex, setCurrentWordIndex } = useProgressStore()
  const { user } = useAuthStore()
  const [words, setWords] = useState<Word[]>([])
  const [userSentence, setUserSentence] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const sessionStartRef = useRef(Date.now())
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 })

  // LLM-powered validation state
  const [isValidating, setIsValidating] = useState(false)
  const [validation, setValidation] = useState<SentenceValidation | null>(null)
  const [showAIFeedback, setShowAIFeedback] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const levelWords = await wordService.getByLevel(selectedLevel)
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

  const currentWord = words[currentWordIndex]

  const handleValidate = async () => {
    if (!userSentence.trim() || !currentWord) return

    setIsValidating(true)
    setShowAIFeedback(false)

    try {
      const result = await validateSentenceWithAI(currentWord, userSentence.trim())
      setValidation(result)
      setShowAIFeedback(true)

      // Update SRS with AI score
      const quality = result.score as 0 | 1 | 2 | 3 | 4 | 5
      const existingProgress = progress.get(currentWord.id)
      updateWordProgress(currentWord.id, quality, user?.id || 'guest', existingProgress || null)
      setSessionStats(prev => ({
        correct: prev.correct + (result.isCorrect ? 1 : 0),
        total: prev.total + 1,
      }))
    } catch (error) {
      console.error('Validation error:', error)
    } finally {
      setIsValidating(false)
    }
  }

  const handleRetry = () => {
    setValidation(null)
    setShowAIFeedback(false)
  }

  useEffect(() => {
    return () => {
      if (sessionStats.total > 0) {
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        recordStudySession(user?.id || 'guest', 'sentence-making', sessionStats.total, Math.round((sessionStats.correct / sessionStats.total) * 100), duration)
      }
    }
  }, [])

  const nextWord = () => {
    if (currentWordIndex < words.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1)
      setUserSentence('')
      setIsValidating(false)
      setValidation(null)
      setShowAIFeedback(false)
      setShowHint(false)
    }
  }

  const prevWord = () => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex(currentWordIndex - 1)
      setUserSentence('')
      setIsValidating(false)
      setValidation(null)
      setShowAIFeedback(false)
      setShowHint(false)
    }
  }

  const playTTS = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-6xl">✍️</span>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-4">No Words Available</h2>
      </div>
    )
  }

  const scoreColor = validation
    ? (validation.score >= 4 ? 'text-green-500'
      : validation.score >= 3 ? 'text-yellow-500'
      : validation.score >= 1 ? 'text-orange-500'
      : 'text-red-500')
    : 'text-gray-500'

  const scoreBg = validation
    ? (validation.score >= 4 ? 'from-green-500/10 to-emerald-500/10 border-green-500/20'
      : validation.score >= 3 ? 'from-yellow-500/10 to-amber-500/10 border-yellow-500/20'
      : validation.score >= 1 ? 'from-orange-500/10 to-red-500/10 border-orange-500/20'
      : 'from-red-500/10 to-pink-500/10 border-red-500/20')
    : ''

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            Sentence Making
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Word {currentWordIndex + 1} of {words.length} • HSK {selectedLevel}
          </p>
        </div>
        {sessionStats.total > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {sessionStats.correct}/{sessionStats.total} correct
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentWordIndex + 1) / words.length) * 100}%` }}
        />
      </div>

      {/* Word card */}
      <motion.div
        key={currentWord.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card py-8"
      >
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Create a sentence using:</p>
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <button
              onClick={() => playTTS(currentWord.chinese)}
              className="p-1.5 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
            >
              <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </button>
            <span className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 chinese-text">
              {currentWord.chinese}
            </span>
            <span className="text-lg text-gray-600 dark:text-gray-400">
              ({currentWord.pinyin})
            </span>
          </div>
          <p className="mt-3 text-lg text-gray-700 dark:text-gray-300">
            Meaning: <span className="font-medium">{currentWord.english}</span>
          </p>
          {currentWord.pos && Array.isArray(currentWord.pos) && currentWord.pos.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {currentWord.pos.map((p) => (
                <span key={p} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs rounded-full">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Text input */}
          <textarea
            value={userSentence}
            onChange={(e) => setUserSentence(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey && userSentence.trim() && !isValidating) {
                handleValidate()
              }
            }}
            placeholder="Type your Chinese sentence here..."
            disabled={isValidating}
            className="input-field min-h-[120px] resize-none text-lg disabled:opacity-50"
          />

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowHint(!showHint)}
              disabled={isValidating}
              className="btn-secondary flex items-center gap-1.5"
            >
              <Lightbulb className="w-4 h-4" />
              {showHint ? 'Hide Hint' : 'Hint'}
            </button>
            {showAIFeedback && validation ? (
              <button onClick={handleRetry} className="btn-secondary flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
            ) : null}
            <button
              onClick={handleValidate}
              disabled={!userSentence.trim() || isValidating}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI Checking...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Check with AI
                </>
              )}
            </button>
          </div>

          {/* Hint section */}
          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl"
              >
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4" />
                  Hint
                </p>
                {currentWord.example_sentences && currentWord.example_sentences.length > 0 ? (
                  <div className="space-y-2">
                    {currentWord.example_sentences.slice(0, 2).map((s, i) => (
                      <p key={i} className="text-gray-700 dark:text-gray-300 text-sm">
                        {s}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Try using "{currentWord.chinese}" ({currentWord.english}) in a simple sentence.
                    {currentWord.pos?.includes('verb') && ' Think about who does the action and what they do it to.'}
                    {currentWord.pos?.includes('noun') && ' Think about describing or using this thing.'}
                    {currentWord.pos?.includes('adjective') && ' Think about what you can describe with this word.'}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Feedback section */}
          <AnimatePresence>
            {showAIFeedback && validation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-5 rounded-2xl border bg-gradient-to-br ${scoreBg} space-y-4`}
              >
                {/* Score badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {validation.isCorrect ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                    <span className={`text-2xl font-bold ${scoreColor}`}>
                      {validation.score}/5
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`w-3 h-3 rounded-full ${
                          star <= validation.score
                            ? validation.score >= 4 ? 'bg-green-500'
                              : validation.score >= 3 ? 'bg-yellow-500'
                              : 'bg-red-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Feedback text */}
                <p className="text-gray-800 dark:text-gray-200 font-medium">
                  {validation.feedback}
                </p>

                {/* Corrections */}
                {validation.corrections.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Corrections</p>
                    {validation.corrections.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                        <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Better sentence */}
                {validation.betterSentence && validation.betterSentence !== userSentence && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Better version
                    </p>
                    <p className="text-gray-800 dark:text-gray-200 font-medium chinese-text">
                      {validation.betterSentence}
                    </p>
                    <button
                      onClick={() => playTTS(validation.betterSentence)}
                      className="mt-1.5 text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                    >
                      <Volume2 className="w-3 h-3" />
                      Listen
                    </button>
                  </div>
                )}

                {/* Grammar tips */}
                {validation.grammarTips.length > 0 && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" />
                      Grammar Tips
                    </p>
                    {validation.grammarTips.map((tip, i) => (
                      <p key={i} className="text-sm text-indigo-700 dark:text-indigo-300">
                        {tip}
                      </p>
                    ))}
                  </div>
                )}

                {/* Next word button on success */}
                {validation.isCorrect && currentWordIndex < words.length - 1 && (
                  <button
                    onClick={nextWord}
                    className="w-full py-3 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                  >
                    Next Word
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prevWord}
          disabled={currentWordIndex === 0}
          className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>
        <button onClick={nextWord} disabled={currentWordIndex >= words.length - 1} className="btn-primary flex items-center gap-1.5 disabled:opacity-40">
          Next Word
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tips */}
      <div className="card bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          AI-Powered Tips
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• AI evaluates your grammar, word usage, and naturalness</li>
          <li>• You'll get a score from 0-5 with detailed feedback</li>
          <li>• Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Enter</kbd> to check quickly</li>
          <li>• Pay attention to word order (Subject-Verb-Object)</li>
          <li>• Don't forget measure words when needed!</li>
        </ul>
      </div>
    </div>
  )
}
