import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { getWeakWords } from '@/services/sqlite-api'
import { Word, UserProgress } from '@/types'
import { getToneColor, splitPinyinSyllables } from '@/utils/pinyin'
import { updateWordProgress, correctToQuality, recordStudySession } from '@/utils/study-helpers'
import { playCorrectSound, playWrongSound } from '@/utils/sound'
import { Target, CheckCircle, XCircle, RotateCcw, ChevronRight, Brain, TrendingDown, Trophy, Sparkles } from 'lucide-react'
import SEO from '@/components/SEO/Helmet'
import { PAGE_SEO } from '@/utils/seo'

type Phase = 'setup' | 'playing' | 'result'
type QuizMode = 'zh-en' | 'en-zh' | 'py-zh'

const QUIZ_MODE_OPTIONS: { id: QuizMode; label: string; prompt: string }[] = [
  { id: 'zh-en', label: 'ZH → EN', prompt: 'What does this mean?' },
  { id: 'en-zh', label: 'EN → ZH', prompt: 'Which character matches this?' },
  { id: 'py-zh', label: 'PY → ZH', prompt: 'Which character sounds like this?' },
]

interface QuestionResult {
  word: Word
  correct: boolean
  userAnswer: string
}

export default function WeakWordsMode() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [weakWords, setWeakWords] = useState<Word[]>([])
  const [allWords, setAllWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('setup')

  const [quizMode, setQuizMode] = useState<QuizMode>('zh-en')
  const [questionCount, setQuestionCount] = useState(10)

  const [quizWords, setQuizWords] = useState<Word[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Word | null>(null)
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>([])
  const [questionNumber, setQuestionNumber] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showNext, setShowNext] = useState(false)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [correctCount, setCorrectCount] = useState(0)
  const sessionStartRef = useRef(Date.now())
  const advanceQuestionRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const userId = user?.id || 'guest'
        const [weak, all, userProgress] = await Promise.all([
          getWeakWords(userId, 100),
          wordService.getAll(),
          progressService.getUserProgress(userId),
        ])
        setWeakWords(weak)
        setAllWords(all)
        setProgress(new Map(userProgress.map((p) => [p.word_id, p])))
      } catch (error) {
        console.error('Failed to load weak words:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const generateQuestion = useCallback((qWords: Word[], qNum: number) => {
    if (qWords.length < 4 || qNum >= qWords.length) return

    const correctWord = qWords[qNum]
    const otherWords = allWords.filter(w => w.id !== correctWord.id)
    const wrongWords = shuffleArray(otherWords).slice(0, 3)

    let questionOptions: { text: string; isCorrect: boolean }[]

    if (quizMode === 'en-zh') {
      questionOptions = shuffleArray([
        { text: correctWord.chinese, isCorrect: true },
        ...wrongWords.map(w => ({ text: w.chinese, isCorrect: false }))
      ])
    } else if (quizMode === 'py-zh') {
      questionOptions = shuffleArray([
        { text: correctWord.chinese, isCorrect: true },
        ...wrongWords.map(w => ({ text: w.chinese, isCorrect: false }))
      ])
    } else {
      questionOptions = shuffleArray([
        { text: correctWord.english, isCorrect: true },
        ...wrongWords.map(w => ({ text: w.english, isCorrect: false }))
      ])
    }

    setCurrentQuestion(correctWord)
    setOptions(questionOptions)
    setSelectedAnswer(null)
    setShowNext(false)
  }, [allWords, quizMode])

  const handleAnswer = (answer: string, correct: boolean) => {
    if (!currentQuestion || selectedAnswer !== null) return

    setSelectedAnswer(answer)

    if (correct) {
      playCorrectSound()
      setCorrectCount(prev => prev + 1)
    } else {
      playWrongSound()
    }

    setResults(prev => [...prev, {
      word: currentQuestion,
      correct,
      userAnswer: answer,
    }])

    const quality = correctToQuality(correct)
    const existingProgress = progress.get(currentQuestion.id)
    updateWordProgress(currentQuestion.id, quality, user?.id || 'guest', existingProgress || null)

    if (correct) {
      setTimeout(() => advanceQuestionRef.current(), 600)
    } else {
      setTimeout(() => setShowNext(true), 1200)
    }
  }

  const advanceQuestion = () => {
    const nextNum = questionNumber + 1
    if (nextNum >= questionCount) {
      endGame()
    } else {
      setQuestionNumber(nextNum)
      generateQuestion(quizWords, nextNum)
    }
  }
  advanceQuestionRef.current = advanceQuestion

  const startGame = () => {
    const pool = shuffleArray(weakWords)
    const selected = pool.slice(0, Math.min(questionCount, weakWords.length))
    setQuizWords(selected)
    setCorrectCount(0)
    setQuestionNumber(0)
    setResults([])
    setPhase('playing')
    generateQuestion(selected, 0)
  }

  const endGame = () => {
    setPhase('result')
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const totalCount = results.length
    if (totalCount > 0) {
      recordStudySession(
        user?.id || 'guest',
        'timed-quiz',
        totalCount,
        Math.round((correctCount / totalCount) * 100),
        duration
      )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-red-500 border-t-transparent" />
      </div>
    )
  }

  // Setup phase
  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <SEO {...PAGE_SEO.learn} />
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)', boxShadow: '0 8px 25px rgba(239,68,68,0.35)' }}>
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Weak Words Practice</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-2 text-sm">
            Focus on the words you've struggled with. Get them right to move them out of your weak list.
          </p>
        </div>

        {weakWords.length === 0 ? (
          <div className="card text-center py-12 space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30">
              <Trophy className="w-7 h-7 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-ink-900 dark:text-white">No Weak Words!</h2>
            <p className="text-ink-500 dark:text-ink-400 text-sm max-w-md mx-auto">
              You haven't struggled with any words yet. Keep practicing — wrong answers from quizzes and exercises will appear here automatically.
            </p>
            <button
              onClick={() => navigate('/learn')}
              className="btn-primary inline-flex items-center gap-2"
            >
              Back to Learn
            </button>
          </div>
        ) : (
          <>
            <div className="card space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-700/30">
                <TrendingDown className="w-5 h-5 text-red-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">
                    {weakWords.length} weak word{weakWords.length !== 1 ? 's' : ''} found
                  </p>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                    These are words where your mastery level is below 3. Practice them to improve.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Quiz Mode</h3>
                <div className="flex justify-center gap-2">
                  {QUIZ_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setQuizMode(opt.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        quizMode === opt.id ? 'pill-active' : 'pill-inactive'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Number of Questions</h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {[5, 10, 15, 20, 30].filter(n => n <= weakWords.length).concat(weakWords.length > 30 ? [50] : []).filter((v, i, a) => a.indexOf(v) === i).map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        questionCount === count ? 'pill-active' : 'pill-inactive'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startGame}
                className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)' }}
              >
                <Target className="w-5 h-5" />
                Start Practicing ({Math.min(questionCount, weakWords.length)} words)
              </button>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Preview of your weak words
              </h3>
              <div className="max-h-60 overflow-y-auto scrollbar-hide space-y-1.5">
                {weakWords.slice(0, 20).map((word) => {
                  const p = progress.get(word.id)
                  const mastery = p?.mastery_level ?? 0
                  return (
                    <div key={word.id} className="flex items-center gap-3 p-2 rounded-lg bg-ink-50/50 dark:bg-white/5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        mastery === 0 ? 'bg-red-500' : mastery === 1 ? 'bg-orange-500' : 'bg-amber-500'
                      }`} />
                      <span className="text-sm font-medium text-ink-900 dark:text-white chinese-text">{word.chinese}</span>
                      <span className="text-xs text-ink-500 dark:text-ink-400 truncate flex-1">{word.english}</span>
                      <span className="text-[10px] text-ink-400 dark:text-ink-500 shrink-0">Mastery {mastery}/5</span>
                    </div>
                  )
                })}
                {weakWords.length > 20 && (
                  <p className="text-center text-xs text-ink-400 dark:text-ink-500 pt-2">
                    +{weakWords.length - 20} more...
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // Result phase
  if (phase === 'result') {
    const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0
    const stillWeak = results.filter(r => !r.correct)

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="card text-center py-8 space-y-4"
          style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(245,158,11,0.08) 100%)' }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)', boxShadow: '0 8px 25px rgba(239,68,68,0.35)' }}>
            <Brain className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-ink-900 dark:text-white">Practice Complete!</h2>

          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{correctCount}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Improved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{stillWeak.length}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Still Weak</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold gradient-text">{accuracy}%</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Accuracy</p>
            </div>
          </div>

          {stillWeak.length === 0 && correctCount > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              All your weak words improved! Great job.
            </p>
          )}
        </div>

        {results.length > 0 && (
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Question Review</h3>
            <div className="max-h-60 overflow-y-auto scrollbar-hide space-y-2">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl ${
                  r.correct ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'
                }`}>
                  {r.correct
                    ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  }
                  <span className="text-sm font-medium text-ink-900 dark:text-white chinese-text">{r.word.chinese}</span>
                  <span className="text-xs text-ink-500 dark:text-ink-400 truncate flex-1">{r.word.english}</span>
                  {!r.correct && (
                    <span className="text-xs text-red-500 shrink-0">Still weak</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/learn')}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            Back to Learn
          </button>
          <button
            onClick={() => { setPhase('setup'); setResults([]) }}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)' }}
          >
            <RotateCcw className="w-4 h-4" /> Practice Again
          </button>
        </div>
      </div>
    )
  }

  // Playing phase
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">
              Weak Words
            </span>
            <p className="text-sm text-ink-500 dark:text-ink-400">Question {questionNumber + 1}/{questionCount}</p>
          </div>
          <p className="text-2xl font-bold gradient-text">{correctCount} ✓</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-ink-500 dark:text-ink-400">Accuracy</p>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            {questionNumber > 0 ? Math.round((correctCount / questionNumber) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="h-1.5 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${((questionNumber + 1) / questionCount) * 100}%`,
            background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 100%)',
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion?.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="card py-8"
        >
          {quizMode === 'zh-en' && (
            <>
              <p className="text-center text-sm text-ink-400 dark:text-ink-500 mb-2">What does this mean?</p>
              <p className="text-center text-5xl sm:text-6xl font-bold text-ink-900 dark:text-white chinese-text">
                {currentQuestion?.chinese}
              </p>
              <div className="mt-3 text-center text-lg">
                {currentQuestion && splitPinyinSyllables(currentQuestion.pinyin).map(({ syllable, tone }, i) => (
                  <span key={i} className={getToneColor(tone)}>
                    {syllable}{i < currentQuestion.pinyin.split(' ').length - 1 ? ' ' : ''}
                  </span>
                ))}
              </div>
            </>
          )}
          {quizMode === 'en-zh' && (
            <>
              <p className="text-center text-sm text-ink-400 dark:text-ink-500 mb-2">Which character matches this?</p>
              <p className="text-center text-2xl sm:text-3xl font-semibold text-ink-900 dark:text-white px-6">
                {currentQuestion?.english}
              </p>
            </>
          )}
          {quizMode === 'py-zh' && (
            <>
              <p className="text-center text-sm text-ink-400 dark:text-ink-500 mb-2">Which character sounds like this?</p>
              <div className="text-center text-3xl sm:text-4xl font-semibold">
                {currentQuestion && splitPinyinSyllables(currentQuestion.pinyin).map(({ syllable, tone }, i) => (
                  <span key={i} className={getToneColor(tone)}>
                    {syllable}{i < currentQuestion.pinyin.split(' ').length - 1 ? ' ' : ''}
                  </span>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        {options.map((option, index) => {
          const isSelected = selectedAnswer === option.text
          const showCorrect = selectedAnswer !== null && option.isCorrect
          const showWrong = isSelected && !option.isCorrect
          const isChineseOption = quizMode === 'en-zh' || quizMode === 'py-zh'

          return (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleAnswer(option.text, option.isCorrect)}
              disabled={selectedAnswer !== null}
              className={`p-4 rounded-2xl text-left font-medium text-sm transition-all flex items-start gap-3 ${
                showCorrect
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                  : showWrong
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                  : 'card hover:shadow-lg'
              }`}
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                showCorrect
                  ? 'bg-white/25'
                  : showWrong
                  ? 'bg-white/25'
                  : 'bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300'
              }`}>
                {String.fromCharCode(65 + index)}
              </span>
              <span className={`pt-0.5 ${isChineseOption ? 'text-lg chinese-text' : ''}`}>{option.text}</span>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {showNext && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => advanceQuestionRef.current()}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)' }}
          >
            {questionNumber + 1 >= questionCount ? 'See Results' : 'Next'}
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
