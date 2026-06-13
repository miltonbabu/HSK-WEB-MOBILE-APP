import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore, useProgressStore } from '@/stores'
import { wordService, leaderboardService, progressService } from '@/services/sqlite-api'
import { Word, UserProgress } from '@/types'
import { getToneColor, splitPinyinSyllables } from '@/utils/pinyin'
import { updateWordProgress, correctToQuality, recordStudySession } from '@/utils/study-helpers'
import { Timer, CheckCircle, XCircle, Share2, Download, RotateCcw, Trophy, Clock, Target, Zap, ChevronRight } from 'lucide-react'

const QUESTION_COUNTS = [10, 15, 20, 25, 30, 40, 50]
const TIMER_OPTIONS = [5, 10, 15, 30]

type QuizPhase = 'setup' | 'playing' | 'result'
type QuizMode = 'zh-en' | 'en-zh' | 'py-zh'

const QUIZ_MODE_OPTIONS: { id: QuizMode; label: string; prompt: string }[] = [
  { id: 'zh-en', label: 'ZH → EN', prompt: 'What does this mean?' },
  { id: 'en-zh', label: 'EN → ZH', prompt: 'Which character matches this?' },
  { id: 'py-zh', label: 'PY → ZH', prompt: 'Which character sounds like this?' },
]

interface QuestionResult {
  word: Word
  correct: boolean
  timeTaken: number
  userAnswer: string
}

export default function TimedQuizMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<QuizPhase>('setup')
  const [questionCount, setQuestionCount] = useState(10)
  const [timerSeconds, setTimerSeconds] = useState(5)
  const [quizMode, setQuizMode] = useState<QuizMode>('zh-en')
  const [currentQuestion, setCurrentQuestion] = useState<Word | null>(null)
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>([])
  const [questionNumber, setQuestionNumber] = useState(0)
  const [timeLeft, setTimeLeft] = useState(5)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showNext, setShowNext] = useState(false)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [quizWords, setQuizWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const questionStartTime = useRef(Date.now())
  const sessionStartRef = useRef(Date.now())
  const advanceQuestionRef = useRef<() => void>(() => {})

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

  useEffect(() => {
    return () => {
      if (results.length > 0) {
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        recordStudySession(user?.id || 'guest', 'timed-quiz', results.length, Math.round((correctCount / results.length) * 100), duration)
      }
    }
  }, [])

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
    const otherWords = words.filter(w => w.id !== correctWord.id)
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
    setTimeLeft(timerSeconds)
    setSelectedAnswer(null)
    setShowNext(false)
    questionStartTime.current = Date.now()
  }, [words, timerSeconds, quizMode])

  useEffect(() => {
    if (phase === 'playing' && timeLeft > 0 && selectedAnswer === null) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            handleTimeout()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [phase, timeLeft, selectedAnswer])

  const handleTimeout = () => {
    if (!currentQuestion || selectedAnswer !== null) return
    const timeTaken = (Date.now() - questionStartTime.current) / 1000
    setSelectedAnswer('__timeout__')
    setResults(prev => [...prev, { word: currentQuestion, correct: false, timeTaken, userAnswer: '(timeout)' }])
    setTimeout(() => setShowNext(true), 1500)
  }

  const handleAnswer = (answer: string, correct: boolean) => {
    if (!currentQuestion || selectedAnswer !== null) return

    const timeTaken = (Date.now() - questionStartTime.current) / 1000
    setSelectedAnswer(answer)

    if (correct) {
      const timeBonus = Math.round((timeLeft / timerSeconds) * 10)
      setScore(prev => prev + 10 + timeBonus)
      setCorrectCount(prev => prev + 1)
    }

    setResults(prev => [...prev, {
      word: currentQuestion,
      correct,
      timeTaken,
      userAnswer: answer || '(timeout)'
    }])

    if (currentQuestion) {
      const quality = correctToQuality(correct)
      const existingProgress = progress.get(currentQuestion.id)
      updateWordProgress(currentQuestion.id, quality, user?.id || 'guest', existingProgress || null)
    }

    if (correct) {
      setTimeout(() => advanceQuestionRef.current(), 500)
    } else {
      setTimeout(() => setShowNext(true), 1500)
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
    const shuffled = shuffleArray(words)
    const selected = shuffled.slice(0, Math.min(questionCount, words.length))
    setQuizWords(selected)
    setScore(0)
    setCorrectCount(0)
    setQuestionNumber(0)
    setResults([])
    setPhase('playing')
    generateQuestion(selected, 0)
  }

  const endGame = async () => {
    setPhase('result')

    if (user && user.id !== 'guest') {
      try {
        await leaderboardService.addEntry({
          user_id: user.id,
          username: user.username || 'Anonymous',
          avatar_url: user.avatar_url || '',
          score,
          accuracy: questionCount > 0 ? (correctCount / questionCount) * 100 : 0,
          mode: 'timed-quiz',
          date: new Date().toISOString(),
        })
      } catch (error) {
        console.error('Failed to save score:', error)
      }
    }

    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    recordStudySession(user?.id || 'guest', 'timed-quiz', results.length, Math.round((correctCount / results.length) * 100), duration)
  }

  const shareResult = async () => {
    const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0
    const avgTime = results.length > 0
      ? (results.reduce((sum, r) => sum + r.timeTaken, 0) / results.length).toFixed(1)
      : '0'
    const shareText = `🎯 HSK ${selectedLevel} Timed Quiz\n✅ ${correctCount}/${questionCount} correct (${accuracy}%)\n⏱️ Avg: ${avgTime}s per question\n🏆 Score: ${score} pts\n\nTry it yourself!`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `HSK ${selectedLevel} Quiz Result`,
          text: shareText,
          url: window.location.href,
        })
      } catch {
        copyToClipboard(shareText)
      }
    } else {
      copyToClipboard(shareText)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Result copied to clipboard!')
    })
  }

  const downloadResultCard = () => {
    const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0
    const avgTime = results.length > 0
      ? (results.reduce((sum, r) => sum + r.timeTaken, 0) / results.length).toFixed(1)
      : '0'
    const grade = accuracy >= 90 ? 'S' : accuracy >= 80 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 60 ? 'C' : accuracy >= 50 ? 'D' : 'F'
    const gradeColors: Record<string, string> = {
      S: '#8b5cf6', A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444'
    }
    const color = gradeColors[grade]

    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const gradient = ctx.createLinearGradient(0, 0, 600, 400)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(1, '#16213e')
    ctx.fillStyle = gradient
    ctx.roundRect(0, 0, 600, 400, 24)
    ctx.fill()

    ctx.fillStyle = color
    ctx.font = 'bold 72px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(grade, 300, 120)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('HSK ' + selectedLevel + ' Timed Quiz', 300, 175)

    ctx.font = '20px sans-serif'
    ctx.fillStyle = '#a0a0b8'
    ctx.fillText(`${correctCount}/${questionCount} correct  •  ${accuracy}%  •  Avg ${avgTime}s`, 300, 220)

    ctx.font = 'bold 36px sans-serif'
    ctx.fillStyle = color
    ctx.fillText(`${score} pts`, 300, 280)

    ctx.font = '14px sans-serif'
    ctx.fillStyle = '#555570'
    ctx.fillText('MY HSK 4 App', 300, 360)

    const link = document.createElement('a')
    link.download = `hsk${selectedLevel}-quiz-result.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent" />
      </div>
    )
  }

  if (words.length < 4) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Timer className="w-16 h-16 text-ink-400 dark:text-ink-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-ink-900 dark:text-white">Not Enough Words</h2>
        <p className="text-ink-500 dark:text-ink-400 mt-2">Need at least 4 words for a quiz. Try a different HSK level.</p>
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', boxShadow: '0 8px 25px rgba(139,92,246,0.35)' }}>
            <Timer className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Timed Quiz</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-2">
            Answer questions as fast as you can! Faster answers earn bonus points.
          </p>
        </div>

        <div className="card space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Quiz Mode</h3>
            <div className="flex justify-center gap-2">
              {QUIZ_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setQuizMode(opt.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    quizMode === opt.id
                      ? 'pill-active'
                      : 'pill-inactive'
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
              {QUESTION_COUNTS.map((count) => (
                <button
                  key={count}
                  onClick={() => setQuestionCount(count)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    questionCount === count
                      ? 'pill-active'
                      : 'pill-inactive'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Time per Question</h3>
            <div className="flex justify-center gap-2">
              {TIMER_OPTIONS.map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => setTimerSeconds(seconds)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    timerSeconds === seconds
                      ? 'pill-active'
                      : 'pill-inactive'
                  }`}
                >
                  {seconds}s
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-ink-500 dark:text-ink-400">
            <span className="flex items-center gap-1.5"><Target className="w-4 h-4" /> {questionCount} questions</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {timerSeconds}s each</span>
          </div>

          <button onClick={startGame} className="btn-primary w-full py-3 text-lg">
            Start Quiz
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0
    const avgTime = results.length > 0
      ? (results.reduce((sum, r) => sum + r.timeTaken, 0) / results.length).toFixed(1)
      : '0'
    const grade = accuracy >= 90 ? 'S' : accuracy >= 80 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 60 ? 'C' : accuracy >= 50 ? 'D' : 'F'
    const gradeColors: Record<string, string> = {
      S: '#8b5cf6', A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444'
    }

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="card text-center py-8 space-y-4"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(236,72,153,0.08) 100%)' }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${gradeColors[grade]} 0%, ${gradeColors[grade]}cc 100%)`, boxShadow: `0 8px 25px ${gradeColors[grade]}55` }}>
            <Trophy className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-ink-900 dark:text-white">Quiz Complete!</h2>

          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${gradeColors[grade]} 0%, ${gradeColors[grade]}cc 100%)`, boxShadow: `0 8px 30px ${gradeColors[grade]}55` }}>
              {grade}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="text-center">
              <p className="text-2xl font-bold gradient-text">{score}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Score</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-ink-900 dark:text-white">{correctCount}/{questionCount}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Correct</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-ink-900 dark:text-white">{accuracy}%</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Accuracy</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-ink-500 dark:text-ink-400">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Avg {avgTime}s</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> HSK {selectedLevel}</span>
          </div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Question Review</h3>
          <div className="max-h-60 overflow-y-auto scrollbar-hide space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl ${
                r.correct
                  ? 'bg-green-50 dark:bg-green-900/10'
                  : 'bg-red-50 dark:bg-red-900/10'
              }`}>
                {r.correct
                  ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                }
                <span className="text-sm font-medium text-ink-900 dark:text-white chinese-text">{r.word.chinese}</span>
                <span className="text-xs text-ink-500 dark:text-ink-400 truncate flex-1">{r.word.english}</span>
                <span className="text-xs text-ink-400 dark:text-ink-500 shrink-0">{r.timeTaken.toFixed(1)}s</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={shareResult} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button onClick={downloadResultCard} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Save Image
          </button>
        </div>

        <button
          onClick={() => { setPhase('setup'); setResults([]) }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/30 dark:hover:bg-white/10 transition-all"
        >
          <RotateCcw className="w-4 h-4" /> New Quiz
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-500 dark:text-ink-400">Question {questionNumber + 1}/{questionCount}</p>
          <p className="text-2xl font-bold gradient-text">{score} pts</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-500 dark:text-ink-400">{correctCount} ✓</span>
          <div className={`text-3xl font-bold tabular-nums ${
            timeLeft <= 3 ? 'text-red-500' : timeLeft <= 7 ? 'text-amber-500' : 'text-ink-900 dark:text-white'
          }`}>
            {timeLeft}s
          </div>
        </div>
      </div>

      <div className="h-2 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden backdrop-blur">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${(timeLeft / timerSeconds) * 100}%` }}
          transition={{ duration: 0.5 }}
          style={{
            background: timeLeft <= 3
              ? 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)'
              : timeLeft <= 7
              ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
              : 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)'
          }}
        />
      </div>

      <div className="h-1.5 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-ink-300 dark:bg-ink-600 transition-all duration-300"
          style={{ width: `${((questionNumber + 1) / questionCount) * 100}%` }}
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
          >
            {questionNumber + 1 >= questionCount ? 'See Results' : 'Next'}
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
