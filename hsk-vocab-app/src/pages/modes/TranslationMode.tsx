import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore, useProgressStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, UserProgress, HSKLevel } from '@/types'
import { Languages, ArrowRight, Check, X, RotateCcw, Trophy, Sparkles, Loader2 } from 'lucide-react'
import { updateWordProgress, recordStudySession } from '@/utils/study-helpers'
import { evaluateTranslationWithAI, AITranslationEval } from '@/services/ai-chat'
import { usageService } from '@/services/usage'
import { isSupabaseConfigured } from '@/services/supabase'

type Direction = 'zh-en' | 'en-zh'
type Phase = 'setup' | 'quiz' | 'results'
type Assessment = 'correct' | 'close' | 'wrong'

interface QuizAnswer {
  word: Word
  userAnswer: string
  correctAnswer: string
  assessment: Assessment
}

export default function TranslationMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const navigate = useNavigate()
  const [words, setWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const [loading, setLoading] = useState(true)

  // Setup state
  const [phase, setPhase] = useState<Phase>('setup')
  const [hskLevel, setHskLevel] = useState<HSKLevel | 'all'>(selectedLevel)
  const [direction, setDirection] = useState<Direction>('zh-en')
  const [questionCount, setQuestionCount] = useState(10)

  // Quiz state
  const [quizWords, setQuizWords] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputAnswer, setInputAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])

  // Results state
  const sessionStartRef = useRef(Date.now())
  const sessionRecordedRef = useRef(false)

  // AI state
  const [useAI, setUseAI] = useState(false)
  const [aiEvaluating, setAiEvaluating] = useState(false)
  const [aiEval, setAiEval] = useState<AITranslationEval | null>(null)
  const isGuest = !user || user.id === 'guest'
  const userId = user?.id || 'guest'
  const [aiRemaining, setAiRemaining] = useState(usageService.getFeatureRemaining(userId, 'translation', isGuest))
  const hasAI = !!import.meta.env.VITE_DEEPSEEK_API_KEY || !!import.meta.env.VITE_AI_BACKEND_URL || isSupabaseConfigured()

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

  const filteredWords = hskLevel === 'all'
    ? words
    : words.filter((w) => w.hsk_level === hskLevel)

  const startQuiz = () => {
    if (filteredWords.length === 0) return
    const shuffled = [...filteredWords].sort(() => Math.random() - 0.5)
    const count = Math.min(questionCount, shuffled.length)
    setQuizWords(shuffled.slice(0, count))
    setCurrentIndex(0)
    setAnswers([])
    setInputAnswer('')
    setSubmitted(false)
    sessionStartRef.current = Date.now()
    sessionRecordedRef.current = false
    setPhase('quiz')
  }

  const handleSubmit = async () => {
    if (!inputAnswer.trim() || submitted) return
    setSubmitted(true)

    if (useAI && hasAI) {
      if (!usageService.canUseFeature(userId, 'translation', isGuest)) return
      setAiEvaluating(true)
      try {
        usageService.recordFeatureUse(userId, 'translation')
        setAiRemaining(usageService.getFeatureRemaining(userId, 'translation', isGuest))
        const evaluation = await evaluateTranslationWithAI(
          quizWords[currentIndex],
          direction,
          inputAnswer.trim()
        )
        setAiEval(evaluation)
        setAiEvaluating(false)
      } catch (err) {
        console.error('AI evaluation failed:', err)
        setAiEvaluating(false)
        // Fallback to manual assessment
        setAiEval(null)
      }
    }
  }

  const handleAssessment = async (assessment: Assessment) => {
    const currentWord = quizWords[currentIndex]
    if (!currentWord) return

    const correctAnswer = direction === 'zh-en' ? currentWord.english : currentWord.chinese
    const answer: QuizAnswer = {
      word: currentWord,
      userAnswer: inputAnswer.trim(),
      correctAnswer,
      assessment,
    }
    setAnswers((prev) => [...prev, answer])

    // SRS integration
    const qualityMap: Record<Assessment, 0 | 3 | 5> = { correct: 5, close: 3, wrong: 0 }
    const userId = user?.id || 'guest'
    const existingProgress = progress.get(currentWord.id)
    await updateWordProgress(currentWord.id, qualityMap[assessment], userId, existingProgress || null)

    // Move to next question or results
    if (currentIndex < quizWords.length - 1) {
      const next = currentIndex + 1
      setCurrentIndex(next)
      setInputAnswer('')
      setSubmitted(false)
    } else {
      // Record session and go to results
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
      const allAnswers = [...answers, answer]
      const correctCount = allAnswers.filter((a) => a.assessment === 'correct').length
      const closeCount = allAnswers.filter((a) => a.assessment === 'close').length
      const totalCount = allAnswers.length
      const accuracy = Math.round(((correctCount + closeCount * 0.5) / totalCount) * 100)
      if (!sessionRecordedRef.current) {
        sessionRecordedRef.current = true
        await recordStudySession(userId, 'translation', totalCount, accuracy, duration)
      }
      setPhase('results')
    }
  }

  // Record session on unmount if quiz was in progress
  useEffect(() => {
    return () => {
      if (phase === 'quiz' && answers.length > 0 && !sessionRecordedRef.current) {
        const userId = user?.id || 'guest'
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        const correctCount = answers.filter((a) => a.assessment === 'correct').length
        const closeCount = answers.filter((a) => a.assessment === 'close').length
        const totalCount = answers.length
        const accuracy = Math.round(((correctCount + closeCount * 0.5) / totalCount) * 100)
        sessionRecordedRef.current = true
        recordStudySession(userId, 'translation', totalCount, accuracy, duration)
      }
    }
  }, [phase, answers.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent" />
      </div>
    )
  }

  // ─── SETUP PHASE ───────────────────────────────────────────
  if (phase === 'setup') {
    const levelOptions: (HSKLevel | 'all')[] = [1, 2, 3, 4, 'all']
    const countOptions = [5, 10, 15, 20]

    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
              boxShadow: '0 8px 25px rgba(167,139,250,0.3)',
            }}
          >
            <Languages className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Translation Mode</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filteredWords.length} words available
          </p>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            HSK Level
          </h2>
          <div className="flex flex-wrap gap-2">
            {levelOptions.map((level) => (
              <button
                key={level}
                onClick={() => setHskLevel(level)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  hskLevel === level
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {level === 'all' ? 'All Levels' : `HSK ${level}`}
              </button>
            ))}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Translation Direction
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setDirection('zh-en')}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold transition-all ${
                direction === 'zh-en'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="chinese-text">中文</span>
              <ArrowRight className="w-4 h-4" />
              <span>English</span>
            </button>
            <button
              onClick={() => setDirection('en-zh')}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold transition-all ${
                direction === 'en-zh'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>English</span>
              <ArrowRight className="w-4 h-4" />
              <span className="chinese-text">中文</span>
            </button>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Number of Questions
          </h2>
          <div className="flex flex-wrap gap-2">
            {countOptions.map((n) => (
              <button
                key={n}
                onClick={() => setQuestionCount(n)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  questionCount === n
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {hasAI && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Auto-Grading</h2>
              </div>
              <button
                onClick={() => {
                  if (isGuest && !usageService.canUseFeature(userId, 'translation', isGuest) && !useAI) return
                  setUseAI(!useAI)
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  useAI ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  useAI ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI evaluates your translations with scores, feedback, and suggestions.
            </p>
            {isGuest && (
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                {useAI ? `${aiRemaining} AI uses remaining today` : `${aiRemaining} free AI uses left`}
              </p>
            )}
            {!isGuest && (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                Unlimited AI access
              </p>
            )}
          </div>
        )}

        <button
          onClick={startQuiz}
          disabled={filteredWords.length === 0}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
            boxShadow: '0 4px 15px rgba(167,139,250,0.3)',
          }}
        >
          <Languages className="w-5 h-5" />
          Start Translation ({Math.min(questionCount, filteredWords.length)} questions)
        </button>
      </div>
    )
  }

  // ─── RESULTS PHASE ─────────────────────────────────────────
  if (phase === 'results') {
    const correctCount = answers.filter((a) => a.assessment === 'correct').length
    const closeCount = answers.filter((a) => a.assessment === 'close').length
    const wrongCount = answers.filter((a) => a.assessment === 'wrong').length
    const totalCount = answers.length
    const accuracy = totalCount > 0 ? Math.round(((correctCount + closeCount * 0.5) / totalCount) * 100) : 0
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card text-center py-8 space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <Trophy
              className={`w-16 h-16 mx-auto ${
                accuracy >= 80 ? 'text-yellow-500' : accuracy >= 50 ? 'text-blue-500' : 'text-orange-500'
              }`}
            />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Translation Complete!</h1>

          <div className="flex justify-center gap-6">
            <div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{correctCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Correct</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-yellow-500">{closeCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Close</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-500">{wrongCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Wrong</p>
            </div>
          </div>

          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-xs mx-auto">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${accuracy}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className={`h-full rounded-full ${
                accuracy >= 80 ? 'bg-green-500' : accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
            />
          </div>

          <div className="flex justify-center gap-8 text-sm text-gray-500 dark:text-gray-400">
            <span>Accuracy: <strong className="text-gray-900 dark:text-white">{accuracy}%</strong></span>
            <span>Time: <strong className="text-gray-900 dark:text-white">{minutes > 0 ? `${minutes}m ` : ''}{seconds}s</strong></span>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Review Answers
          </h2>
          {answers.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`card flex items-center gap-3 p-3 ${
                a.assessment === 'correct'
                  ? 'border-l-4 border-green-500'
                  : a.assessment === 'close'
                  ? 'border-l-4 border-yellow-500'
                  : 'border-l-4 border-red-500'
              }`}
            >
              {a.assessment === 'correct' ? (
                <Check className="w-5 h-5 text-green-500 shrink-0" />
              ) : a.assessment === 'close' ? (
                <div className="w-5 h-5 rounded-full bg-yellow-500 shrink-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">~</span>
                </div>
              ) : (
                <X className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white chinese-text">{a.word.chinese}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{a.word.pinyin} • {a.word.english}</p>
              </div>
              <div className="text-right text-xs">
                <p className={`${a.assessment === 'correct' ? 'text-green-600 dark:text-green-400' : 'text-red-500 line-through'}`}>
                  {a.userAnswer}
                </p>
                {a.assessment !== 'correct' && (
                  <p className="text-green-600 dark:text-green-400 font-medium">{a.correctAnswer}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/learn')}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            Back to Learn
          </button>
          <button
            onClick={startQuiz}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
              boxShadow: '0 4px 15px rgba(167,139,250,0.3)',
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ─── QUIZ PHASE ────────────────────────────────────────────
  const currentWord = quizWords[currentIndex]
  if (!currentWord) return null

  const promptText = direction === 'zh-en' ? currentWord.chinese : currentWord.english
  const correctAnswer = direction === 'zh-en' ? currentWord.english : currentWord.chinese
  const promptLabel = direction === 'zh-en' ? 'Translate to English' : 'Translate to Chinese'
  const placeholder = direction === 'zh-en' ? 'Type the English meaning...' : '输入中文翻译...'

  const handleAINext = () => {
    if (!aiEval) return
    const assessment: Assessment = aiEval.score >= 5 ? 'correct' : aiEval.score >= 3 ? 'close' : 'wrong'
    handleAssessment(assessment)
    setAiEval(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Translation</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Question {currentIndex + 1} of {quizWords.length} •{' '}
            {direction === 'zh-en' ? '中文 → English' : 'English → 中文'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">Score</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">{answers.filter((a) => a.assessment === 'correct').length}</span>
            <span className="text-sm text-gray-400 dark:text-gray-500">/</span>
492→            <span className="text-sm font-semibold text-yellow-500">{answers.filter((a) => a.assessment === 'close').length}</span>
493→            <span className="text-sm text-gray-400 dark:text-gray-500">/</span>
            <span className="text-sm font-semibold text-red-500">{answers.filter((a) => a.assessment === 'wrong').length}</span>
          </div>
        </div>
      </div>

      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${((currentIndex + (submitted ? 1 : 0)) / quizWords.length) * 100}%`,
            background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
          }}
        />
      </div>

      <motion.div
        key={currentWord.id + currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="card py-8"
      >
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{promptLabel}</p>
          <p
            className={`text-4xl font-bold text-gray-900 dark:text-white mb-6 ${
              direction === 'zh-en' ? 'chinese-text' : ''
            }`}
          >
            {promptText}
          </p>
          {direction === 'zh-en' && (
            <p className="text-lg text-gray-400 dark:text-gray-500 mb-6">{currentWord.pinyin}</p>
          )}

          {!submitted ? (
            <>
              <input
                type="text"
                value={inputAnswer}
                onChange={(e) => setInputAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="input-field text-center text-xl max-w-md mx-auto"
                placeholder={placeholder}
                autoFocus
              />
              <button
                onClick={handleSubmit}
                disabled={!inputAnswer.trim()}
                className="btn-primary w-full max-w-md mx-auto mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                  boxShadow: '0 4px 15px rgba(167,139,250,0.3)',
                }}
              >
                Submit
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : useAI && aiEval ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className={`rounded-xl p-4 space-y-2 ${
                aiEval.score >= 5 ? 'bg-green-50 dark:bg-green-900/20' : aiEval.score >= 3 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Your answer:</span>
                  <span className={`font-semibold ${aiEval.score >= 5 ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>{inputAnswer.trim()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Correct answer:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{aiEval.correctAnswer}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Score:</span>
                  <span className="font-semibold">{aiEval.score}/5</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{aiEval.feedback}</p>
                {aiEval.suggestions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-gray-500">Tips:</p>
                    {aiEval.suggestions.map((s, i) => (
                      <p key={i} className="text-xs text-purple-600 dark:text-purple-400">{s}</p>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleAINext}
                className="btn-primary w-full max-w-md mx-auto flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                }}
              >
                {currentIndex < quizWords.length - 1 ? 'Next Question' : 'See Results'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          ) : submitted && (useAI && aiEvaluating) ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">AI is evaluating your translation...</span>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Your answer:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{inputAnswer.trim()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Correct answer:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {correctAnswer}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400">How did you do?</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleAssessment('correct')}
                  className="flex-1 max-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    boxShadow: '0 4px 15px rgba(34,197,94,0.3)',
                  }}
                >
                  <Check className="w-4 h-4" />
                  Correct
                </button>
                <button
                  onClick={() => handleAssessment('close')}
                  className="flex-1 max-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                    boxShadow: '0 4px 15px rgba(234,179,8,0.3)',
                  }}
                >
                  <span className="text-base">~</span>
                  Close
                </button>
                <button
                  onClick={() => handleAssessment('wrong')}
                  className="flex-1 max-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    boxShadow: '0 4px 15px rgba(239,68,68,0.3)',
                  }}
                >
                  <X className="w-4 h-4" />
                  Wrong
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      <div className="flex justify-center gap-1">
        {quizWords.map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              i === currentIndex
                ? 'bg-purple-500'
                : i < currentIndex
                ? answers[i]?.assessment === 'correct'
                  ? 'bg-green-500'
                  : answers[i]?.assessment === 'close'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
