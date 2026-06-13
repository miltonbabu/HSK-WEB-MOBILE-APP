import { useState, useEffect, useRef } from 'react'
import { motion, Reorder } from 'framer-motion'
import { useProgressStore, useAuthStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, UserProgress } from '@/types'
import { updateWordProgress, recordStudySession } from '@/utils/study-helpers'

export default function SentencePuzzleMode() {
  const { selectedLevel, currentWordIndex, setCurrentWordIndex } = useProgressStore()
  const { user } = useAuthStore()
  const [words, setWords] = useState<Word[]>([])
  const [sentence, setSentence] = useState<string[]>([])
  const [correctOrder, setCorrectOrder] = useState<string[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [moves, setMoves] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const sessionStartRef = useRef(Date.now())
  const [wordsStudied, setWordsStudied] = useState(0)

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
    if (words.length > 0) {
      generatePuzzle()
    }
  }, [currentWordIndex, words])

  const generatePuzzle = () => {
    const word = words[currentWordIndex]
    if (!word || !word.example_sentences || word.example_sentences.length === 0) return

    const exampleSentence = word.example_sentences[0]
    const chars = exampleSentence.split('').filter((c) => c.trim())

    const shuffled = [...chars].sort(() => Math.random() - 0.5)
    setSentence(shuffled)
    setCorrectOrder(chars)
    setIsComplete(false)
    setMoves(0)
    setShowHint(false)
  }

  useEffect(() => {
    if (sentence.length > 0 && !isComplete) {
      const isCorrect = sentence.join('') === correctOrder.join('')
      if (isCorrect) {
        setIsComplete(true)
        const quality = moves <= correctOrder.length + 2 ? 5 : moves <= correctOrder.length * 2 ? 4 : 3
        const existingProgress = progress.get(words[currentWordIndex].id)
        updateWordProgress(words[currentWordIndex].id, quality, user?.id || 'guest', existingProgress || null)
        setWordsStudied(prev => prev + 1)
      }
    }
  }, [sentence, correctOrder, isComplete])

  useEffect(() => {
    return () => {
      if (wordsStudied > 0) {
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        recordStudySession(user?.id || 'guest', 'sentence-puzzle', wordsStudied, 100, duration)
      }
    }
  }, [])

  const handleReorder = (newOrder: string[]) => {
    setSentence(newOrder)
    setMoves((prev) => prev + 1)
  }

  const nextPuzzle = () => {
    if (currentWordIndex < words.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1)
    }
  }

  const prevPuzzle = () => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex(currentWordIndex - 1)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  if (words.length === 0 || !words[currentWordIndex]?.example_sentences?.length) {
    return (
      <div className="text-center py-12">
        <span className="text-6xl">🧩</span>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-4">No Puzzle Available</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          This word doesn't have example sentences for puzzle practice.
        </p>
      </div>
    )
  }

  const currentWord = words[currentWordIndex]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sentence Puzzle</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Puzzle {currentWordIndex + 1} of {words.length} • HSK {selectedLevel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">Moves</p>
          <p className="text-lg font-semibold text-teal-600 dark:text-teal-400">{moves}</p>
        </div>
      </div>

      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentWordIndex + 1) / words.length) * 100}%` }}
        />
      </div>

      <motion.div
        key={currentWord.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card py-8"
      >
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {isComplete ? '🎉 Correct!' : 'Drag and drop to arrange the sentence:'}
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Word: <span className="font-bold text-teal-600 dark:text-teal-400 chinese-text">{currentWord.chinese}</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentWord.english}</p>
        </div>

        <Reorder.Group axis="x" values={sentence} onReorder={handleReorder} className="flex flex-wrap justify-center gap-2 mb-8">
          {sentence.map((char, index) => (
            <Reorder.Item
              key={char + index}
              value={char}
              className={`w-12 h-12 flex items-center justify-center bg-white dark:bg-gray-700 border-2 rounded-lg font-bold text-2xl cursor-grab active:cursor-grabbing select-none ${
                isComplete ? 'border-green-500 text-green-500' : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
              }`}
            >
              {char}
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {showHint && !isComplete && (
          <div className="text-center mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Target sentence:</p>
            <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">{correctOrder.join('')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Pinyin: {currentWord.pinyin}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => setShowHint(!showHint)} className="btn-secondary">
            {showHint ? 'Hide Hint' : 'Show Hint'}
          </button>
          <button onClick={generatePuzzle} className="btn-secondary flex-1">
            Reset
          </button>
        </div>
      </motion.div>

      <div className="flex justify-between">
        <button onClick={prevPuzzle} disabled={currentWordIndex === 0} className="btn-secondary">
          ← Previous
        </button>
        <button onClick={nextPuzzle} className="btn-primary">
          Next →
        </button>
      </div>

      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
        >
          <div className="text-center">
            <span className="text-4xl">🎉</span>
            <h3 className="text-lg font-semibold text-green-700 dark:text-green-300 mt-2">
              Completed in {moves} moves!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Target: {correctOrder.join('')}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}