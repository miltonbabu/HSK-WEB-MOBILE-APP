import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore, useProgressStore } from '@/stores'
import { wordService } from '@/services/sqlite-api'
import { Word } from '@/types'
import { BookOpen, Sparkles, ArrowRight, RotateCcw, CheckCircle2, XCircle } from 'lucide-react'
import { generateStory, GeneratedStory } from '@/services/ai-features'
import { recordStudySession } from '@/utils/study-helpers'
import SEO from '@/components/SEO/Helmet'
import { PAGE_SEO } from '@/utils/seo'

type Phase = 'setup' | 'story' | 'quiz' | 'results'

export default function StoryMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('setup')
  const [wordCount, setWordCount] = useState(5)
  const [generating, setGenerating] = useState(false)

  const [story, setStory] = useState<GeneratedStory | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const sessionStartRef = useRef(Date.now())

  useEffect(() => {
    async function loadData() {
      try {
        const allWords = await wordService.getAll()
        setWords(allWords)
      } catch (e) {
        console.error('Failed to load words:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const startStory = async () => {
    setGenerating(true)
    try {
      const result = await generateStory(selectedLevel, words, wordCount)
      setStory(result)
      setPhase('story')
      setShowTranslation(false)
      setQuizAnswers([])
      setCurrentQuestion(0)
      sessionStartRef.current = Date.now()
    } catch (err) {
      console.error('Story generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  const startQuiz = () => {
    setPhase('quiz')
    setQuizAnswers(new Array(story!.questions.length).fill(-1))
    setCurrentQuestion(0)
  }

  const answerQuestion = (optionIndex: number) => {
    const newAnswers = [...quizAnswers]
    newAnswers[currentQuestion] = optionIndex
    setQuizAnswers(newAnswers)

    if (currentQuestion < story!.questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 600)
    } else {
      setTimeout(() => {
        setPhase('results')
        const correct = newAnswers.filter((a, i) => a === story!.questions[i].correctIndex).length
        const total = story!.questions.length
        const accuracy = Math.round((correct / total) * 100)
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        recordStudySession(user?.id || 'guest', 'visual', total, accuracy, duration)
      }, 600)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent" />
      </div>
    )
  }

  // ── Setup ──
  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <SEO {...PAGE_SEO.story} />
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', boxShadow: '0 8px 25px rgba(139,92,246,0.35)' }}>
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Story Mode</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Read a story crafted from your HSK {selectedLevel} vocabulary, then test your comprehension
          </p>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Target Words</h2>
            <div className="flex flex-wrap gap-2">
              {[3, 5, 8, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setWordCount(n)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    wordCount === n ? 'bg-purple-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {n} words
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            AI generates a unique story using words from your current level
          </div>

          <button
            onClick={startStory}
            disabled={generating}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Generating story…
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Story
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── Story Reading ──
  if (phase === 'story' && story) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{story.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            HSK {selectedLevel} · {story.targetWords.length} target words
          </p>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4">
          <div className="text-lg chinese-text leading-relaxed text-gray-900 dark:text-white">
            {story.storyChinese}
          </div>

          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium"
          >
            {showTranslation ? 'Hide translation' : 'Show translation & pinyin'}
          </button>

          {showTranslation && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Pinyin</p>
                <p className="text-sm text-teal-600 dark:text-teal-400 italic">{story.storyPinyin}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">English</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{story.storyEnglish}</p>
              </div>
            </motion.div>
          )}
        </motion.div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Target Words</h3>
          <div className="flex flex-wrap gap-1.5">
            {story.targetWords.map((w, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                {w}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setPhase('setup')} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> New Story
          </button>
          <button onClick={startQuiz} className="btn-primary flex-1 flex items-center justify-center gap-2">
            Test Comprehension <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // ── Quiz ──
  if (phase === 'quiz' && story) {
    const q = story.questions[currentQuestion]
    const selected = quizAnswers[currentQuestion]

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Comprehension Quiz</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentQuestion + 1} / {story.questions.length}
          </span>
        </div>

        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${((currentQuestion + 1) / story.questions.length) * 100}%` }} />
        </div>

        <motion.div key={currentQuestion} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="card py-8">
          <p className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{q.question}</p>
          <div className="grid grid-cols-1 gap-3">
            {q.options.map((option, i) => (
              <button
                key={i}
                onClick={() => answerQuestion(i)}
                className={`p-4 rounded-xl text-left font-medium transition-all ${
                  selected === i
                    ? i === q.correctIndex
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Results ──
  if (phase === 'results' && story) {
    const correct = quizAnswers.filter((a, i) => a === story.questions[i].correctIndex).length
    const total = story.questions.length
    const accuracy = Math.round((correct / total) * 100)

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card text-center py-8 space-y-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <BookOpen className={`w-16 h-16 mx-auto ${accuracy >= 80 ? 'text-yellow-500' : accuracy >= 50 ? 'text-blue-500' : 'text-orange-500'}`} />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Story Complete!</h1>
          <div className="flex justify-center gap-8">
            <div><p className="text-3xl font-bold text-purple-600">{accuracy}%</p><p className="text-xs text-gray-500">Accuracy</p></div>
            <div><p className="text-3xl font-bold text-green-600">{correct}</p><p className="text-xs text-gray-500">Correct</p></div>
            <div><p className="text-3xl font-bold text-red-500">{total - correct}</p><p className="text-xs text-gray-500">Wrong</p></div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Review</h2>
          {story.questions.map((q, i) => (
            <div key={i} className={`card flex items-center gap-3 p-3 ${quizAnswers[i] === q.correctIndex ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
              {quizAnswers[i] === q.correctIndex ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{q.question}</p>
                {quizAnswers[i] !== q.correctIndex && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    Correct: {q.options[q.correctIndex]}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setPhase('setup')} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> New Story
          </button>
          <button onClick={() => setPhase('story')} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4" /> Re-read Story
          </button>
        </div>
      </div>
    )
  }

  return null
}