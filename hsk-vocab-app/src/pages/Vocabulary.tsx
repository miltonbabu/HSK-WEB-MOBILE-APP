import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, HSKLevel, UserProgress } from '@/types'
import { Search, ChevronLeft, ChevronRight, ChevronDown, Filter } from 'lucide-react'

const LEVEL_COLORS: Record<HSKLevel, { bg: string; shadow: string }> = {
  1: { bg: '#8b5cf6', shadow: 'rgba(139,92,246,0.35)' },
  2: { bg: '#10b981', shadow: 'rgba(16,185,129,0.35)' },
  3: { bg: '#f59e0b', shadow: 'rgba(245,158,11,0.35)' },
  4: { bg: '#ec4899', shadow: 'rgba(236,72,153,0.35)' },
  5: { bg: '#3b82f6', shadow: 'rgba(59,130,246,0.35)' },
  6: { bg: '#ef4444', shadow: 'rgba(239,68,68,0.35)' },
}

const PAGE_SIZE = 20

interface ExampleData {
  chinese: string
  pinyin: string
  english: string
}

function cleanEn(en: string): string {
  return en.split(';')[0].split(',')[0].replace(/\([^)]*\)/g, '').trim()
}

function generateExamples(word: Word): ExampleData[] {
  if (Array.isArray(word.example_sentences) && word.example_sentences.length > 0) {
    return word.example_sentences.map((s) => ({ chinese: s, pinyin: '', english: '' }))
  }
  const ch = word.chinese
  const py = word.pinyin
  const en = cleanEn(word.english)
  const pos = Array.isArray(word.pos) ? word.pos : []

  if (pos.includes('verb')) {
    return [
      { chinese: `我${ch}你。`, pinyin: `Wǒ ${py} nǐ.`, english: `I ${en} you.` },
      { chinese: `他${ch}学习中文。`, pinyin: `Tā ${py} xuéxí zhōngwén.`, english: `He ${en}s studying Chinese.` },
      { chinese: `她很${ch}这本书。`, pinyin: `Tā hěn ${py} zhè běn shū.`, english: `She really ${en}s this book.` },
    ]
  } else if (pos.includes('noun')) {
    return [
      { chinese: `这是我的${ch}。`, pinyin: `Zhè shì wǒ de ${py}.`, english: `This is my ${en}.` },
      { chinese: `他的${ch}很好。`, pinyin: `Tā de ${py} hěn hǎo.`, english: `His ${en} is very good.` },
      { chinese: `我喜欢这个${ch}。`, pinyin: `Wǒ xǐhuan zhège ${py}.`, english: `I like this ${en}.` },
    ]
  } else if (pos.includes('adjective')) {
    return [
      { chinese: `今天天气很${ch}。`, pinyin: `Jīntiān tiānqì hěn ${py}.`, english: `The weather is very ${en} today.` },
      { chinese: `她是一个${ch}的人。`, pinyin: `Tā shì yígè ${py} de rén.`, english: `She is a ${en} person.` },
      { chinese: `这个地方非常${ch}。`, pinyin: `Zhège dìfāng fēicháng ${py}.`, english: `This place is very ${en}.` },
    ]
  } else if (pos.includes('adverb')) {
    return [
      { chinese: `我${ch}去学校。`, pinyin: `Wǒ ${py} qù xuéxiào.`, english: `I go to school ${en}.` },
      { chinese: `他${ch}高兴。`, pinyin: `Tā ${py} gāoxìng.`, english: `He is ${en} happy.` },
      { chinese: `她${ch}喜欢唱歌。`, pinyin: `Tā ${py} xǐhuan chànggē.`, english: `She likes singing ${en}.` },
    ]
  } else if (pos.includes('pronoun')) {
    return [
      { chinese: `${ch}是我的朋友。`, pinyin: `${capitalize(py)} shì wǒ de péngyǒu.`, english: `${capitalize(en)} is my friend.` },
      { chinese: `${ch}喜欢看电影。`, pinyin: `${capitalize(py)} xǐhuan kàn diànyǐng.`, english: `${capitalize(en)} likes watching movies.` },
      { chinese: `${ch}每天都很忙。`, pinyin: `${capitalize(py)} měitiān dōu hěn máng.`, english: `${capitalize(en)} is busy every day.` },
    ]
  } else if (pos.includes('preposition')) {
    return [
      { chinese: `我${ch}朋友一起去。`, pinyin: `Wǒ ${py} péngyǒu yìqǐ qù.`, english: `I go together ${en} my friend.` },
      { chinese: `他${ch}我在一起很开心。`, pinyin: `Tā ${py} wǒ zài yìqǐ hěn kāixīn.`, english: `He is very happy together ${en} me.` },
    ]
  } else if (pos.includes('conjunction')) {
    return [
      { chinese: `我${ch}他都是学生。`, pinyin: `Wǒ ${py} tā dōu shì xuéshēng.`, english: `Both he ${en} I are students.` },
      { chinese: `你喜欢茶${ch}咖啡？`, pinyin: `Nǐ xǐhuan chá ${py} kāfēi?`, english: `Do you like tea ${en} coffee?` },
    ]
  } else if (pos.includes('measure')) {
    return [
      { chinese: `我一${ch}书。`, pinyin: `Wǒ yí${py} shū.`, english: `I have one ${en} of book.` },
      { chinese: `他两${ch}猫。`, pinyin: `Tā liǎng${py} māo.`, english: `He has two ${en} of cats.` },
    ]
  } else if (pos.includes('number')) {
    return [
      { chinese: `我有${ch}个朋友。`, pinyin: `Wǒ yǒu ${py} gè péngyǒu.`, english: `I have ${en} friends.` },
      { chinese: `${ch}个人来了。`, pinyin: `${capitalize(py)} gè rén lái le.`, english: `${capitalize(en)} people came.` },
    ]
  } else if (pos.includes('particle')) {
    return [
      { chinese: `好${ch}！`, pinyin: `Hǎo ${py}!`, english: `Okay! / Good!` },
      { chinese: `是${ch}，我知道了。`, pinyin: `Shì ${py}, wǒ zhīdào le.`, english: `Yes, I know.` },
      { chinese: `走吧${ch}！`, pinyin: `Zǒu ba ${py}!`, english: `Let's go!` },
    ]
  } else if (pos.includes('interjection')) {
    return [
      { chinese: `${ch}，你说什么？`, pinyin: `${capitalize(py)}, nǐ shuō shénme?`, english: `${capitalize(en)}! What did you say?` },
      { chinese: `${ch}，太好了！`, pinyin: `${capitalize(py)}, tài hǎo le!`, english: `${capitalize(en)}! That's great!` },
      { chinese: `${ch}，我明白了。`, pinyin: `${capitalize(py)}, wǒ míngbái le.`, english: `${capitalize(en)}! I understand.` },
    ]
  } else if (pos.includes('prefix') || pos.includes('suffix')) {
    return [
      { chinese: `这个${ch}很有意思。`, pinyin: `Zhège ${py} hěn yǒu yìsi.`, english: `This ${en} is very interesting.` },
      { chinese: `那个${ch}不太好。`, pinyin: `Nàge ${py} bú tài hǎo.`, english: `That ${en} is not very good.` },
    ]
  } else {
    return [
      { chinese: `我知道${ch}的意思。`, pinyin: `Wǒ zhīdào ${py} de yìsi.`, english: `I know the meaning of ${en}.` },
      { chinese: `请再说一次${ch}。`, pinyin: `Qǐng zài shuō yícì ${py}.`, english: `Please say ${en} again.` },
      { chinese: `${ch}是什么意思？`, pinyin: `${capitalize(py)} shì shénme yìsi?`, english: `What does ${en} mean?` },
    ]
  }
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ExampleSentence({ sentence, word }: { sentence: string; word: string }) {
  const parts = sentence.split(word)
  if (parts.length === 1) {
    return <span className="text-sm chinese-text leading-relaxed">{sentence}</span>
  }
  return (
    <span className="text-sm chinese-text leading-relaxed">
      {parts.map((part, idx) => (
        <span key={idx}>
          {part}
          {idx < parts.length - 1 && (
            <span className="text-purple-600 dark:text-purple-400 font-bold bg-purple-100/60 dark:bg-purple-900/30 rounded px-0.5">
              {word}
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

function ExampleCard({ example, word, onSpeak, speakId }: { example: ExampleData; word: string; onSpeak: () => void; speakId: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-ink-50/50 dark:bg-white/5 border border-ink-100/30 dark:border-white/5">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1">
          <ExampleSentence sentence={example.chinese} word={word} />
          {example.pinyin && (
            <p className="text-teal-600 dark:text-teal-400 italic text-xs">{example.pinyin}</p>
          )}
          {example.english && (
            <p className="text-ink-600 dark:text-ink-300 text-xs">{example.english}</p>
          )}
        </div>
        <button
          onClick={onSpeak}
          className={`transition-colors flex-shrink-0 mt-0.5 ${
            speakId ? 'text-purple-500' : 'text-ink-400 hover:text-purple-500 active:text-purple-500'
          }`}
          aria-label="Listen to example"
        >
          🔊
        </button>
      </div>
    </div>
  )
}

export default function Vocabulary() {
  const { user } = useAuthStore()
  const [words, setWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filterLevel, setFilterLevel] = useState<HSKLevel | 'all'>('all')
  const [filterPos, setFilterPos] = useState<string>('all')
  const [filterMastery, setFilterMastery] = useState<string>('all')
  const [filterTopic, setFilterTopic] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const warmup = new SpeechSynthesisUtterance('')
    warmup.lang = 'zh-CN'
    warmup.volume = 0
    window.speechSynthesis.speak(warmup)
    window.speechSynthesis.cancel()
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        const allWords = await wordService.getAll()
        setWords(allWords)
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')
        setProgress(new Map(userProgress.map((p) => [p.word_id, p])))
      } catch (error) {
        console.error('Failed to load words:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  const filteredWords = words.filter((w) => {
    const matchesLevel = filterLevel === 'all' || w.hsk_level === filterLevel
    const matchesSearch = searchQuery === '' ||
      w.chinese.includes(searchQuery) ||
      w.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.english.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPos = filterPos === 'all' || (Array.isArray(w.pos) && w.pos.includes(filterPos))
    const matchesTopic = filterTopic === 'all' || w.topic_category === filterTopic
    let matchesMastery = true
    if (filterMastery !== 'all') {
      const p = progress.get(w.id)
      const mastery = p?.mastery_level ?? 0
      if (filterMastery === 'new') matchesMastery = mastery === 0
      else if (filterMastery === 'learning') matchesMastery = mastery >= 1 && mastery <= 2
      else if (filterMastery === 'familiar') matchesMastery = mastery === 3
      else if (filterMastery === 'mastered') matchesMastery = mastery >= 4
    }
    return matchesLevel && matchesSearch && matchesPos && matchesTopic && matchesMastery
  })

  useEffect(() => {
    setPage(1)
  }, [filterLevel, searchQuery, filterPos, filterMastery, filterTopic])

  const totalPages = Math.ceil(filteredWords.length / PAGE_SIZE)
  const pagedWords = filteredWords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const startIndex = (page - 1) * PAGE_SIZE

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Vocabulary</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1 text-sm">
          Browse all {words.length} HSK words across all levels
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setFilterLevel('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterLevel === 'all' ? 'pill-active' : 'pill-inactive'
            }`}
          >
            All words
          </motion.button>
          {([1, 2, 3, 4] as HSKLevel[]).map((level) => {
            const isActive = filterLevel === level
            const count = words.filter((w) => w.hsk_level === level).length
            const color = LEVEL_COLORS[level]
            return (
              <motion.button
                key={level}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setFilterLevel(level)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive ? 'text-white' : 'pill-inactive'
                }`}
                style={isActive ? {
                  background: `linear-gradient(135deg, ${color.bg} 0%, ${color.bg}dd 100%)`,
                  boxShadow: `0 4px 12px ${color.shadow}`,
                } : undefined}
              >
                <span
                  className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={isActive ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: color.bg, color: 'white' }}
                >
                  {level}
                </span>
                HSK {level}
                <span className="text-[10px] opacity-70">({count})</span>
              </motion.button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
            <input
              type="text"
              placeholder="Search words, pinyin, or English..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-9 pr-4 py-2 text-sm w-full sm:w-64"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              showFilters || filterPos !== 'all' || filterMastery !== 'all' || filterTopic !== 'all'
                ? 'pill-active'
                : 'pill-inactive'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {(filterPos !== 'all' || filterMastery !== 'all' || filterTopic !== 'all') && (
              <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[9px] flex items-center justify-center">
                {(filterPos !== 'all' ? 1 : 0) + (filterMastery !== 'all' ? 1 : 0) + (filterTopic !== 'all' ? 1 : 0)}
              </span>
            )}
          </motion.button>
        </div>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="card space-y-4"
        >
          <div>
            <h3 className="text-xs font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider mb-2">Part of Speech</h3>
            <div className="flex flex-wrap gap-1.5">
              {['all', 'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'particle', 'measure', 'number'].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setFilterPos(pos)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    filterPos === pos ? 'bg-purple-500 text-white' : 'bg-ink-100/60 dark:bg-white/10 text-ink-600 dark:text-ink-400 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                  }`}
                >
                  {pos === 'all' ? 'All' : pos}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider mb-2">Mastery Level</h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'all', label: 'All' },
                { key: 'new', label: 'New' },
                { key: 'learning', label: 'Learning' },
                { key: 'familiar', label: 'Familiar' },
                { key: 'mastered', label: 'Mastered' },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setFilterMastery(m.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    filterMastery === m.key ? 'bg-purple-500 text-white' : 'bg-ink-100/60 dark:bg-white/10 text-ink-600 dark:text-ink-400 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider mb-2">Topic</h3>
            <div className="flex flex-wrap gap-1.5">
              {['all', 'daily-life', 'food-drink', 'family', 'education', 'work', 'health', 'weather', 'travel', 'shopping', 'transportation', 'technology', 'time', 'emotions', 'nature', 'numbers', 'culture', 'grammar'].map((topic) => (
                <button
                  key={topic}
                  onClick={() => setFilterTopic(topic)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    filterTopic === topic ? 'bg-purple-500 text-white' : 'bg-ink-100/60 dark:bg-white/10 text-ink-600 dark:text-ink-400 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                  }`}
                >
                  {topic === 'all' ? 'All' : topic.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
          {(filterPos !== 'all' || filterMastery !== 'all' || filterTopic !== 'all') && (
            <button
              onClick={() => { setFilterPos('all'); setFilterMastery('all'); setFilterTopic('all') }}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              Clear all filters
            </button>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden !p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm hidden sm:table">
            <thead>
              <tr className="border-b-2 border-ink-200 dark:border-ink-700 bg-ink-100/60 dark:bg-ink-800/40">
                <th className="text-left py-3 px-4 font-bold text-ink-700 dark:text-ink-200 w-10 text-xs uppercase tracking-wider">#</th>
                <th className="text-left py-3 px-4 font-bold text-ink-700 dark:text-ink-200 text-xs uppercase tracking-wider">Chinese</th>
                <th className="text-left py-3 px-4 font-bold text-ink-700 dark:text-ink-200 text-xs uppercase tracking-wider">Pinyin</th>
                <th className="text-left py-3 px-4 font-bold text-ink-700 dark:text-ink-200 text-xs uppercase tracking-wider">English</th>
                <th className="text-left py-3 px-4 font-bold text-ink-700 dark:text-ink-200 text-xs uppercase tracking-wider">POS</th>
                <th className="text-left py-3 px-4 font-bold text-ink-700 dark:text-ink-200 text-xs uppercase tracking-wider">Level</th>
                <th className="text-left py-3 px-4 font-bold text-ink-700 dark:text-ink-200 w-10 text-xs uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {pagedWords.map((word, i) => {
                const color = LEVEL_COLORS[word.hsk_level]
                const isSpeaking = speakingId === word.id
                const isExpanded = expandedId === word.id
                const examples = generateExamples(word)
                return (
                <>
                <tr
                  key={word.id}
                  onClick={() => setExpandedId(isExpanded ? null : word.id)}
                  className={`border-b border-ink-100 dark:border-white/5 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-ink-50/60 dark:bg-white/[0.02]'}`}
                >
                  <td className="py-2.5 px-4 text-ink-400 dark:text-ink-600 text-xs">{startIndex + i + 1}</td>
                  <td className="py-2.5 px-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); speak(word.chinese, word.id) }}
                      className={`font-semibold text-base chinese-text transition-colors ${
                        isSpeaking
                          ? 'text-purple-500 dark:text-purple-400'
                          : 'text-ink-900 dark:text-white hover:text-purple-500 dark:hover:text-purple-400'
                      }`}
                      aria-label={`Listen to ${word.chinese}`}
                    >
                      {word.chinese}
                    </button>
                  </td>
                  <td className="py-2.5 px-4 text-ink-500 dark:text-ink-400 italic text-xs">{word.pinyin}</td>
                  <td className="py-2.5 px-4 text-ink-600 dark:text-ink-300 text-xs">{word.english}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(word.pos) && word.pos.length > 0
                        ? word.pos.map((p) => (
                            <span key={p} className="inline-block px-1.5 py-0.5 rounded-md bg-white/30 dark:bg-white/10 text-[10px] font-medium text-ink-500 dark:text-ink-400">{p}</span>
                          ))
                        : <span className="text-ink-400 dark:text-ink-600">-</span>}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${color.bg} 0%, ${color.bg}dd 100%)`,
                        boxShadow: `0 2px 8px ${color.shadow}`,
                      }}
                    >
                      HSK {word.hsk_level}
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : word.id)}
                      className={`p-1 rounded-lg transition-colors ${
                        isExpanded ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'text-ink-400 dark:text-ink-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                      }`}
                      aria-label="Toggle examples"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${word.id}-examples`}>
                    <td colSpan={7} className={`px-4 py-3 ${i % 2 === 0 ? 'bg-ink-50/50 dark:bg-white/[0.02]' : 'bg-ink-50/80 dark:bg-white/[0.04]'}`}>
                      <div className="space-y-2 ml-14">
                        <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                          <span className="text-purple-600 dark:text-purple-400 font-bold">{word.chinese}</span>
                          <span className="text-teal-600 dark:text-teal-400 italic">{word.pinyin}</span>
                          <span>= {word.english}</span>
                        </div>
                        {examples.map((ex, si) => (
                          <ExampleCard
                            key={si}
                            example={ex}
                            word={word.chinese}
                            onSpeak={() => speak(ex.chinese, `${word.id}-ex${si}`)}
                            speakId={speakingId === `${word.id}-ex${si}` ? `${word.id}-ex${si}` : ''}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </>
              )})}
            </tbody>
          </table>

          <div className="sm:hidden flex flex-col gap-2 -mx-1">
            {pagedWords.map((word, i) => {
              const color = LEVEL_COLORS[word.hsk_level]
              const isSpeaking = speakingId === word.id
              const isExpanded = expandedId === word.id
              const examples = generateExamples(word)
              return (
                <motion.div
                  key={word.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="card !p-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : word.id)}
                >
                  <div className="relative flex items-center gap-2.5">
                    <span className="text-ink-400 dark:text-ink-500 text-[10px] font-semibold w-4 text-center flex-shrink-0">{startIndex + i + 1}</span>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); speak(word.chinese, word.id) }}
                        className={`w-[3.5rem] h-11 px-2 rounded-xl flex items-center justify-center text-base font-bold chinese-text transition-all whitespace-nowrap ${
                          isSpeaking
                            ? 'text-white'
                            : 'text-white active:scale-95'
                        }`}
                        style={{
                          background: isSpeaking
                            ? `linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)`
                            : `linear-gradient(135deg, ${color.bg} 0%, ${color.bg}cc 100%)`,
                          boxShadow: `0 3px 12px ${color.shadow}`,
                        }}
                        aria-label={`Listen to ${word.chinese}`}
                      >
                        {word.chinese}
                      </button>
                      {Array.isArray(word.pos) && word.pos.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 justify-center">
                          {word.pos.map((p) => (
                            <span key={p} className="px-1 py-0 rounded-md bg-ink-100/50 dark:bg-white/10 text-[9px] font-medium text-ink-500 dark:text-ink-400">{p}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-teal-600 dark:text-teal-400 italic text-sm">{word.pinyin}</p>
                      <p className="text-ink-700 dark:text-ink-200 text-sm">{word.english}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${
                      isExpanded ? 'rotate-180 text-purple-500' : 'text-ink-400 dark:text-ink-500'
                    }`} />
                    <span
                      className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${color.bg} 0%, ${color.bg}cc 100%)`,
                        boxShadow: `0 2px 6px ${color.shadow}`,
                      }}
                    >
                      HSK {word.hsk_level}
                    </span>
                  </div>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 ml-[4.5rem] space-y-2 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                        <span className="text-purple-600 dark:text-purple-400 font-bold">{word.chinese}</span>
                        <span className="text-teal-600 dark:text-teal-400 italic">{word.pinyin}</span>
                        <span>= {word.english}</span>
                      </div>
                      {examples.map((ex, si) => (
                        <ExampleCard
                          key={si}
                          example={ex}
                          word={word.chinese}
                          onSpeak={() => speak(ex.chinese, `${word.id}-ex${si}`)}
                          speakId={speakingId === `${word.id}-ex${si}` ? `${word.id}-ex${si}` : ''}
                        />
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {filteredWords.length === 0 ? (
          <div className="text-center py-16 text-ink-400 dark:text-ink-500">
            <p className="text-lg font-medium mb-1">No words found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-white/20 dark:border-white/5">
            <p className="text-xs text-ink-400 dark:text-ink-500">
              Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredWords.length)} of {filteredWords.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-secondary !px-3 !py-1.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                      pageNum === page ? 'pill-active' : 'text-ink-500 dark:text-ink-400 hover:bg-white/30 dark:hover:bg-white/10'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {totalPages > 5 && page < totalPages - 2 && (
                <span className="text-xs text-ink-400 px-1">…</span>
              )}
              {totalPages > 5 && page < totalPages - 2 && (
                <button
                  onClick={() => setPage(totalPages)}
                  className="w-8 h-8 rounded-lg text-xs font-semibold text-ink-500 dark:text-ink-400 hover:bg-white/30 dark:hover:bg-white/10 transition-all"
                >
                  {totalPages}
                </button>
              )}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-secondary !px-3 !py-1.5 text-xs"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}