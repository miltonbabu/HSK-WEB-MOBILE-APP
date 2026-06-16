import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore, useProgressStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, UserProgress, QuizQuestion } from '@/types'
import { Target, CheckCircle2, XCircle, RotateCcw, Trophy, ArrowRight, Sparkles, HelpCircle } from 'lucide-react'
import { generateGrammarBreakdown, GrammarBreakdown } from '@/services/ai-features'
import { updateWordProgress, correctToQuality, recordStudySession } from '@/utils/study-helpers'
import { generateAIQuizQuestions, AIQuizQuestion } from '@/services/ai-chat'
import { usageService } from '@/services/usage'
import { isSupabaseConfigured } from '@/services/supabase'

type QuestionType = 'mcq' | 'pinyin' | 'english' | 'fill-blank'
type Phase = 'setup' | 'quiz' | 'results'

export default function SequentialQuizMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const [words, setWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const [loading, setLoading] = useState(true)

  // Setup state
  const [phase, setPhase] = useState<Phase>('setup')
  const [questionCount, setQuestionCount] = useState(10)
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['mcq', 'pinyin', 'english', 'fill-blank'])
  const [useAI, setUseAI] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  // AI usage tracking
  const isGuest = !user || user.id === 'guest'
  const userId = user?.id || 'guest'
  const [aiRemaining, setAiRemaining] = useState(usageService.getFeatureRemaining(userId, 'sequential-quiz', isGuest))
  const hasAI = !!import.meta.env.VITE_DEEPSEEK_API_KEY || !!import.meta.env.VITE_AI_BACKEND_URL || isSupabaseConfigured()

  // Quiz state
  const [quizWords, setQuizWords] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [inputAnswer, setInputAnswer] = useState('')

  // Results state
  const [answers, setAnswers] = useState<{ word: Word; correct: boolean; yourAnswer: string; correctAnswer: string }[]>([])
  const sessionStartRef = useRef(Date.now())

  // AI quiz state
  const [aiQuestions, setAiQuestions] = useState<AIQuizQuestion[]>([])
  const [aiCurrentIndex, setAiCurrentIndex] = useState(0)

  // Grammar breakdown state
  const [grammarBreakdowns, setGrammarBreakdowns] = useState<Map<string, GrammarBreakdown>>(new Map())
  const [loadingGrammar, setLoadingGrammar] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const levelWords = await wordService.getByLevel(selectedLevel)
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')
        const progressMap = new Map(userProgress.map((p) => [p.word_id, p]))
        setWords(levelWords)
        setProgress(progressMap)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id, selectedLevel])

  const startQuiz = async () => {
    if (selectedTypes.length === 0) return

    if (useAI && hasAI) {
      // Check AI usage for guests
      if (!usageService.canUseFeature(userId, 'sequential-quiz', isGuest)) {
        return
      }
      setAiLoading(true)
      try {
        usageService.recordFeatureUse(userId, 'sequential-quiz')
        setAiRemaining(usageService.getFeatureRemaining(userId, 'sequential-quiz', isGuest))
        const aiQuestions = await generateAIQuizQuestions(`HSK ${selectedLevel}`, questionCount, words)
        setAiQuestions(aiQuestions)
        setAiCurrentIndex(0)
        setAnswers([])
        setPhase('quiz')
        setAiLoading(false)
      } catch (err) {
        console.error('AI quiz generation failed:', err)
        setAiLoading(false)
        // Fall back to regular mode
      }
    } else {
      const shuffled = [...words].sort(() => Math.random() - 0.5)
      const count = Math.min(questionCount, words.length)
      const selected = shuffled.slice(0, count)
      setQuizWords(selected)
      setCurrentIndex(0)
      setAnswers([])
      setPhase('quiz')
      generateQuestion(selected, 0)
    }
  }

  const generateQuestion = (wordList: Word[], index: number) => {
    const word = wordList[index]
    if (!word) return

    const type = selectedTypes[Math.floor(Math.random() * selectedTypes.length)]

    if (type === 'mcq') {
      const otherWords = words.filter((w) => w.id !== word.id).sort(() => Math.random() - 0.5).slice(0, 5)
      const options = [...otherWords.map((w) => w.english), word.english].sort(() => Math.random() - 0.5)
      setCurrentQuestion({ word, type: 'mcq', options, correctAnswer: word.english })
    } else if (type === 'pinyin') {
      setCurrentQuestion({ word, type: 'pinyin', correctAnswer: word.pinyin })
    } else if (type === 'english') {
      setCurrentQuestion({ word, type: 'english', correctAnswer: word.chinese })
    } else {
      setCurrentQuestion({ word, type: 'fill-blank', correctAnswer: word.english })
    }

    setSelectedAnswer(null)
    setIsCorrect(null)
    setInputAnswer('')
  }

  const handleMCQAnswer = (answer: string) => {
    if (!currentQuestion || selectedAnswer !== null) return
    setSelectedAnswer(answer)
    const correct = answer === currentQuestion.correctAnswer
    setIsCorrect(correct)
    setAnswers((prev) => [...prev, { word: currentQuestion.word, correct, yourAnswer: answer, correctAnswer: currentQuestion.correctAnswer }])
    const quality = correctToQuality(correct)
    const existingProgress = progress.get(currentQuestion.word.id)
    updateWordProgress(currentQuestion.word.id, quality, user?.id || 'guest', existingProgress || null)
  }

  const handleTextAnswer = () => {
    if (!currentQuestion || !inputAnswer.trim() || selectedAnswer !== null) return
    const correct =
      currentQuestion.type === 'pinyin'
        ? inputAnswer.trim().toLowerCase().replace(/\s+/g, '') === currentQuestion.correctAnswer.toLowerCase().replace(/\s+/g, '')
        : inputAnswer.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
    setIsCorrect(correct)
    setSelectedAnswer(inputAnswer)
    setAnswers((prev) => [...prev, { word: currentQuestion.word, correct, yourAnswer: inputAnswer, correctAnswer: currentQuestion.correctAnswer }])
    const quality = correctToQuality(correct)
    const existingProgress = progress.get(currentQuestion.word.id)
    updateWordProgress(currentQuestion.word.id, quality, user?.id || 'guest', existingProgress || null)
  }

  const nextQuestion = () => {
    if (selectedAnswer === null) return

    // AI mode navigation
    if (useAI && aiQuestions.length > 0) {
      if (aiCurrentIndex < aiQuestions.length - 1) {
        setAiCurrentIndex(aiCurrentIndex + 1)
        setSelectedAnswer(null)
        setIsCorrect(null)
        setInputAnswer('')
      } else {
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        const correctCount = answers.filter((a) => a.correct).length
        const totalCount = answers.length
        if (totalCount > 0) {
          recordStudySession(user?.id || 'guest', 'sequential-quiz', totalCount, Math.round((correctCount / totalCount) * 100), duration)
        }
        setPhase('results')
      }
      return
    }

    if (currentIndex < quizWords.length - 1) {
      const next = currentIndex + 1
      setCurrentIndex(next)
      generateQuestion(quizWords, next)
    } else {
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
      const correctCount = answers.filter((a) => a.correct).length
      const totalCount = answers.length
      if (totalCount > 0) {
        recordStudySession(user?.id || 'guest', 'sequential-quiz', totalCount, Math.round((correctCount / totalCount) * 100), duration)
      }
      setPhase('results')
    }
  }

  const handleAIAnswer = (answer: string) => {
    if (selectedAnswer !== null || aiQuestions.length === 0) return
    setSelectedAnswer(answer)
    const q = aiQuestions[aiCurrentIndex]
    const correct = answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
    setIsCorrect(correct)

    // Find the matching word or create a fallback answer entry
    const matchedWord = words.find((w) => w.chinese === q.word)
    setAnswers((prev) => [...prev, {
      word: matchedWord || { id: '', chinese: q.word, pinyin: q.pinyin, english: q.english, hsk_level: selectedLevel, pos: [], pos_raw: '', example_sentences: [], audio_url: '', radical: '', stroke_count: 0, topic_category: '' } as Word,
      correct,
      yourAnswer: answer,
      correctAnswer: q.correctAnswer,
    }])

    if (matchedWord) {
      const quality = correctToQuality(correct)
      const existingProgress = progress.get(matchedWord.id)
      updateWordProgress(matchedWord.id, quality, user?.id || 'guest', existingProgress || null)
    }
  }

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter((t) => t !== type) : prev) : [...prev, type]
    )
  }

  const handleGrammarBreakdown = async (wordId: string, word: Word, yourAnswer: string, correctAnswer: string) => {
    if (grammarBreakdowns.has(wordId) || loadingGrammar) return
    setLoadingGrammar(wordId)
    try {
      const breakdown = await generateGrammarBreakdown(word, yourAnswer, correctAnswer)
      setGrammarBreakdowns((prev) => new Map(prev).set(wordId, breakdown))
    } catch (err) {
      console.error('Grammar breakdown failed:', err)
    } finally {
      setLoadingGrammar(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-6xl">📝</span>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-4">No Words Available</h2>
      </div>
    )
  }

  // ─── SETUP PHASE ───────────────────────────────────────────
  if (phase === 'setup') {
    const countOptions = [5, 10, 15, 20, 30, 50]
    const typeLabels: Record<QuestionType, string> = {
      mcq: 'Multiple Choice',
      pinyin: 'Type Pinyin',
      english: 'Type Chinese',
      'fill-blank': 'Type English',
    }

    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sequential Quiz</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">HSK {selectedLevel} • {words.length} words available</p>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Number of Questions</h2>
          <div className="flex flex-wrap gap-2">
            {countOptions.map((n) => (
              <button
                key={n}
                onClick={() => setQuestionCount(n)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  questionCount === n
                    ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Question Types</h2>
          <div className="space-y-2">
            {(Object.keys(typeLabels) as QuestionType[]).map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${
                  selectedTypes.includes(type)
                    ? 'bg-primary-500/10 border-2 border-primary-500 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                  selectedTypes.includes(type) ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  {selectedTypes.includes(type) && <CheckCircle2 className="w-4 h-4" />}
                </div>
                {typeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        {hasAI && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI-Powered Questions</h2>
              </div>
              <button
                onClick={() => {
                  if (isGuest && !usageService.canUseFeature(userId, 'sequential-quiz', isGuest) && !useAI) return
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
              AI generates smarter, context-aware questions with better distractors and explanations.
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
          disabled={aiLoading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Target className="w-5 h-5" />
          Start Quiz ({Math.min(questionCount, words.length)} questions)
        </button>
      </div>
    )
  }

  // ─── RESULTS PHASE ─────────────────────────────────────────
  if (phase === 'results') {
    const correctCount = answers.filter((a) => a.correct).length
    const totalCount = answers.length
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card text-center py-8 space-y-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <Trophy className={`w-16 h-16 mx-auto ${accuracy >= 80 ? 'text-yellow-500' : accuracy >= 50 ? 'text-blue-500' : 'text-orange-500'}`} />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quiz Complete!</h1>
          <div className="flex justify-center gap-8">
            <div>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{accuracy}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{correctCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Correct</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-500">{totalCount - correctCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Wrong</p>
            </div>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-xs mx-auto">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${accuracy}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className={`h-full rounded-full ${accuracy >= 80 ? 'bg-green-500' : accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Review Answers</h2>
          {answers.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`card flex items-center gap-3 p-3 ${a.correct ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}
            >
              {a.correct ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white chinese-text">{a.word.chinese}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{a.word.pinyin}</p>
              </div>
              {!a.correct && (
                <div className="text-right text-xs">
                  <p className="text-red-500 line-through">{a.yourAnswer}</p>
                  <p className="text-green-600 dark:text-green-400 font-medium">{a.correctAnswer}</p>
                </div>
              )}
            </motion.div>
            {!a.correct && a.word.id && (
              <div className="ml-8" key={`grammar-${i}`}>
                {grammarBreakdowns.has(a.word.id) ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-1 p-3 rounded-xl bg-purple-50/80 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-700/30 text-xs"
                  >
                    <p className="font-semibold text-purple-700 dark:text-purple-300 mb-1">{grammarBreakdowns.get(a.word.id)!.usage}</p>
                    {grammarBreakdowns.get(a.word.id)!.grammarPoints.length > 0 && (
                      <ul className="list-disc list-inside text-purple-600 dark:text-purple-400 space-y-0.5 mb-1">
                        {grammarBreakdowns.get(a.word.id)!.grammarPoints.map((pt, j) => (
                          <li key={j}>{pt}</li>
                        ))}
                      </ul>
                    )}
                    {grammarBreakdowns.get(a.word.id)!.exampleSentences.length > 0 && (
                      <div className="text-ink-600 dark:text-ink-400 italic">
                        {grammarBreakdowns.get(a.word.id)!.exampleSentences.map((s, j) => (
                          <p key={j}>{s}</p>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <button
                    onClick={() => handleGrammarBreakdown(a.word.id, a.word, a.yourAnswer, a.correctAnswer)}
                    disabled={loadingGrammar === a.word.id}
                    className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                  >
                    <HelpCircle className="w-3 h-3" />
                    {loadingGrammar === a.word.id ? 'Explaining…' : 'Why?'}
                  </button>
                )}
              </div>
            )}
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setPhase('setup')} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" />
            New Quiz
          </button>
          <button onClick={startQuiz} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <ArrowRight className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ─── QUIZ PHASE ────────────────────────────────────────────
  const currentWord = quizWords[currentIndex]
  const wordProgress = progress.get(currentWord?.id)

  // AI Quiz rendering
  if (useAI && aiQuestions.length > 0) {
    const aiQ = aiQuestions[aiCurrentIndex]
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Quiz</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <Sparkles className="w-3 h-3 inline mr-0.5" />AI
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Question {aiCurrentIndex + 1} of {aiQuestions.length} • HSK {selectedLevel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
            <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
              {answers.length > 0 ? Math.round((answers.filter((a) => a.correct).length / answers.length) * 100) : 0}%
            </p>
          </div>
        </div>

        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${((aiCurrentIndex + 1) / aiQuestions.length) * 100}%` }}
          />
        </div>

        <motion.div
          key={aiQ.word + aiCurrentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card py-8"
        >
          {aiQ.type === 'mcq' ? (
            <>
              <p className="text-center text-4xl font-bold text-gray-900 dark:text-white mb-4 chinese-text">
                {aiQ.word}
              </p>
              <p className="text-center text-lg text-gray-500 dark:text-gray-400 mb-2">
                {aiQ.pinyin}
              </p>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                {aiQ.question}
              </p>
              <div className="grid grid-cols-1 gap-3">
                {aiQ.options?.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleAIAnswer(option)}
                    disabled={selectedAnswer !== null}
                    className={`p-4 rounded-xl text-left font-medium transition-all ${
                      selectedAnswer === option
                        ? option === aiQ.correctAnswer
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                        : selectedAnswer && option === aiQ.correctAnswer
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-lg text-gray-500 dark:text-gray-400 mb-2">
                {aiQ.pinyin}
              </p>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                {aiQ.question}
              </p>
              <input
                type="text"
                value={inputAnswer}
                onChange={(e) => setInputAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputAnswer.trim()) {
                    handleAIAnswer(inputAnswer.trim())
                  }
                }}
                className="input-field text-center text-xl"
                placeholder="Type your answer..."
                disabled={selectedAnswer !== null}
              />
              <button
                onClick={() => handleAIAnswer(inputAnswer.trim())}
                disabled={!inputAnswer.trim() || selectedAnswer !== null}
                className="btn-primary w-full mt-4"
              >
                Submit
              </button>
            </>
          )}

          {isCorrect !== null && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`mt-4 p-4 rounded-xl text-center ${
                isCorrect ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}
            >
              {isCorrect ? 'Correct!' : `Incorrect. Answer: ${aiQ.correctAnswer}`}
              {aiQ.explanation && (
                <p className="text-xs mt-1 opacity-80">{aiQ.explanation}</p>
              )}
            </motion.div>
          )}
        </motion.div>

        <div className="flex justify-center">
          <button
            onClick={nextQuestion}
            disabled={selectedAnswer === null}
            className="btn-primary flex items-center gap-2"
          >
            {aiCurrentIndex < aiQuestions.length - 1 ? 'Next Question' : 'See Results'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center gap-1">
          {aiQuestions.map((_, i) => (
            <button
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                i === aiCurrentIndex
                  ? 'bg-purple-500'
                  : i < aiCurrentIndex
                  ? answers[i]?.correct
                    ? 'bg-green-500'
                    : 'bg-red-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sequential Quiz</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Question {currentIndex + 1} of {quizWords.length} • HSK {selectedLevel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
          <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
            {answers.length > 0 ? Math.round((answers.filter((a) => a.correct).length / answers.length) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / quizWords.length) * 100}%` }}
        />
      </div>

      {wordProgress && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i <= (wordProgress?.mastery_level || 0)
                  ? i >= 4
                    ? 'bg-green-500'
                    : i >= 2
                    ? 'bg-yellow-500'
                    : 'bg-orange-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      )}

      <motion.div
        key={currentWord?.id + currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="card py-8"
      >
        {currentQuestion?.type === 'mcq' && (
          <>
            <p className="text-center text-4xl font-bold text-gray-900 dark:text-white mb-6 chinese-text">
              {currentWord?.chinese}
            </p>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">Select the correct meaning:</p>
            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.options?.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleMCQAnswer(option)}
                  disabled={selectedAnswer !== null}
                  className={`p-4 rounded-xl text-left font-medium transition-all ${
                    selectedAnswer === option
                      ? option === currentQuestion.correctAnswer
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      : selectedAnswer && option === currentQuestion.correctAnswer
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        )}

        {currentQuestion?.type === 'pinyin' && (
          <>
            <p className="text-center text-4xl font-bold text-gray-900 dark:text-white mb-6 chinese-text">
              {currentWord?.chinese}
            </p>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">Type the pinyin:</p>
            <input
              type="text"
              value={inputAnswer}
              onChange={(e) => setInputAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextAnswer()}
              className="input-field text-center text-xl"
              placeholder="nǐ hǎo"
              disabled={selectedAnswer !== null}
            />
            <button onClick={handleTextAnswer} className="btn-primary w-full mt-4" disabled={selectedAnswer !== null}>
              Submit
            </button>
          </>
        )}

        {currentQuestion?.type === 'english' && (
          <>
            <p className="text-center text-4xl font-bold text-gray-900 dark:text-white mb-6">
              {currentWord?.pinyin}
            </p>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">Type the Chinese character:</p>
            <input
              type="text"
              value={inputAnswer}
              onChange={(e) => setInputAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextAnswer()}
              className="input-field text-center text-xl"
              placeholder="你 好"
              disabled={selectedAnswer !== null}
            />
            <button onClick={handleTextAnswer} className="btn-primary w-full mt-4" disabled={selectedAnswer !== null}>
              Submit
            </button>
          </>
        )}

        {currentQuestion?.type === 'fill-blank' && (
          <>
            <p className="text-center text-4xl font-bold text-gray-900 dark:text-white mb-6 chinese-text">
              {currentWord?.chinese}
            </p>
            <p className="text-center text-lg text-gray-500 dark:text-gray-400 mb-4">
              {currentWord?.pinyin}
            </p>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">Type the English meaning:</p>
            <input
              type="text"
              value={inputAnswer}
              onChange={(e) => setInputAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextAnswer()}
              className="input-field text-center text-xl"
              placeholder="hello, good"
              disabled={selectedAnswer !== null}
            />
            <button onClick={handleTextAnswer} className="btn-primary w-full mt-4" disabled={selectedAnswer !== null}>
              Submit
            </button>
          </>
        )}

        {isCorrect !== null && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`mt-4 p-4 rounded-xl text-center ${
              isCorrect ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            }`}
          >
            {isCorrect ? '🎉 Correct!' : `❌ Incorrect. The answer is: ${currentQuestion?.correctAnswer}`}
          </motion.div>
        )}
      </motion.div>

      <div className="flex justify-center">
        <button
          onClick={nextQuestion}
          disabled={selectedAnswer === null}
          className="btn-primary flex items-center gap-2"
        >
          {currentIndex < quizWords.length - 1 ? 'Next Question' : 'See Results'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-center gap-1">
        {quizWords.map((_, i) => (
          <button
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              i === currentIndex
                ? 'bg-primary-500'
                : i < currentIndex
                ? answers[i]?.correct
                  ? 'bg-green-500'
                  : 'bg-red-500'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
