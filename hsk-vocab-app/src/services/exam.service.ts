// HSK 4 Mock Exam — question generation + grading service.
//
// Hybrid strategy:
//   - Algorithmic generators build most questions instantly from the
//     existing 2000-word vocabulary (offline, no AI calls).
//   - AI generators (via callLLM) produce richer passages/dialogues and
//     picture prompts. Batched: one LLM call per question type per exam.
//   - If AI fails or the user is offline, every AI question type falls
//     back to its algorithmic counterpart so the exam always completes.

import { Word, HSKLevel } from '@/types'
import { ExamLength, ExamSection, ExamSectionId, ExamQuestion, ExamResult, ExamQuestionReview } from '@/types/exam'
import { wordService } from './sqlite-api'
import { isAnswerCorrect } from '@/utils/answer-match'
import { callLLM } from './ai-features'

// ── Helpers ──────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

function uid(prefix: string, i: number): string {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2, 7)}`
}

// Split a Chinese sentence into draggable tokens (characters or short
// word groups). For exam reordering we split into individual characters
// but filter punctuation so the puzzle isn't trivially hard.
function tokenize(sentence: string): string[] {
  return sentence
    .split('')
    .filter((c) => c.trim() && !/[。，！？、；：""''（）.,!?;:'"()]/.test(c))
}

// ── Question-count config ────────────────────────────────────────

interface SectionPlan {
  listeningTF: number
  listeningDialogue: number
  listeningPassage: number
  readingCloze: number
  readingMatch: number
  readingPassage: number
  writingReorder: number
  writingPicture: number
}

const PLANS: Record<ExamLength, SectionPlan> = {
  full: {
    listeningTF: 10,
    listeningDialogue: 15,
    listeningPassage: 20,
    readingCloze: 10,
    readingMatch: 10,
    readingPassage: 20,
    writingReorder: 5,
    writingPicture: 10,
  },
  practice: {
    listeningTF: 4,
    listeningDialogue: 5,
    listeningPassage: 6,
    readingCloze: 4,
    readingMatch: 3,
    readingPassage: 3,
    writingReorder: 3,
    writingPicture: 2,
  },
}

const DURATIONS: Record<ExamLength, Record<ExamSectionId, number>> = {
  full: { listening: 30 * 60, reading: 40 * 60, writing: 25 * 60 },
  practice: { listening: 10 * 60, reading: 10 * 60, writing: 5 * 60 },
}

// ── Algorithmic generators ───────────────────────────────────────

function genListeningTF(words: Word[], count: number): ExamQuestion[] {
  return pick(words, count).map((w, i) => {
    const sentence = w.example_sentences?.[0] || `${w.chinese}很好。`
    // Statement claims the sentence means the word's English meaning.
    // Correct = true. We also randomly flip to false with a wrong meaning.
    const flip = Math.random() < 0.5
    const wrongMeaning = pick(words.filter((x) => x.id !== w.id), 1)[0]?.english || 'something else'
    const statement = flip
      ? `The speaker is talking about: ${wrongMeaning}`
      : `The speaker is talking about: ${w.english}`
    return {
      id: uid('ltf', i),
      section: 'listening',
      type: 'listening-tf',
      prompt: 'Listen and decide if the statement is true or false.',
      audioText: sentence,
      options: ['True', 'False'],
      correctAnswer: flip ? 'False' : 'True',
      word: w,
    }
  })
}

function genListeningDialogueMCQ(words: Word[], count: number): ExamQuestion[] {
  const picked = pick(words, count)
  return picked.map((w, i) => {
    const other = pick(words.filter((x) => x.id !== w.id), 1)[0]
    const line1 = other?.example_sentences?.[0] || `你知道${other?.chinese || '这个'}吗？`
    const line2 = w.example_sentences?.[0] || `我知道${w.chinese}。`
    const dialogue = `男：${line1}\n女：${line2}`
    const distractors = pick(
      words.filter((x) => x.id !== w.id),
      3,
    ).map((x) => x.english)
    const options = shuffle([w.english, ...distractors])
    return {
      id: uid('ldlg', i),
      section: 'listening',
      type: 'listening-mcq',
      prompt: 'Listen to the dialogue. What is the woman talking about?',
      audioText: `${line1} ${line2}`,
      passage: dialogue,
      options,
      correctAnswer: w.english,
      word: w,
    }
  })
}

function genReadingCloze(words: Word[], count: number): ExamQuestion[] {
  return pick(words, count).map((w, i) => {
    const sentence = w.example_sentences?.[0] || `我喜欢${w.chinese}。`
    // Replace the target word (Chinese) with a blank.
    const blanked = sentence.replace(w.chinese, '＿＿＿')
    const distractors = pick(
      words.filter((x) => x.id !== w.id && x.pos.some((p) => w.pos.includes(p))),
      3,
    ).map((x) => x.chinese)
    // If not enough same-POS distractors, fill from any words.
    while (distractors.length < 3) {
      const extra = pick(words.filter((x) => x.id !== w.id && !distractors.includes(x.chinese)), 1)[0]
      if (extra) distractors.push(extra.chinese)
      else break
    }
    const options = shuffle([w.chinese, ...distractors])
    return {
      id: uid('rclz', i),
      section: 'reading',
      type: 'reading-cloze',
      prompt: 'Choose the correct word to fill in the blank.',
      passage: blanked,
      options,
      correctAnswer: w.chinese,
      word: w,
    }
  })
}

function genReadingMatch(words: Word[], count: number): ExamQuestion[] {
  // Each "question" is one Chinese sentence to match to its English.
  const picked = pick(words, count)
  return picked.map((w, i) => {
    const sentence = w.example_sentences?.[0] || `这是${w.chinese}。`
    const distractors = pick(
      words.filter((x) => x.id !== w.id),
      3,
    ).map((x) => x.english)
    const options = shuffle([w.english, ...distractors])
    return {
      id: uid('rmtc', i),
      section: 'reading',
      type: 'reading-match',
      prompt: 'Choose the English translation that matches the Chinese sentence.',
      passage: sentence,
      options,
      correctAnswer: w.english,
      word: w,
    }
  })
}

function genWritingReorder(words: Word[], count: number): ExamQuestion[] {
  return pick(words, count).map((w, i) => {
    const sentence = w.example_sentences?.[0] || `我喜欢${w.chinese}。`
    const tokens = tokenize(sentence)
    const shuffled = shuffle(tokens)
    return {
      id: uid('wrdr', i),
      section: 'writing',
      type: 'writing-reorder',
      prompt: 'Rearrange the characters to form the correct sentence.',
      shuffledWords: shuffled,
      correctAnswer: tokens.join(''),
      acceptableAnswers: [tokens.join('')],
      word: w,
    }
  })
}

// ── AI generators (batched, with fallback) ───────────────────────

interface AIPassageQuestion {
  passage: string
  question: string
  options: string[]
  answer: string
  word: string
}

async function genAIPassageQuestions(
  words: Word[],
  count: number,
  kind: 'listening' | 'reading',
  signal?: AbortSignal,
): Promise<{ questions: AIPassageQuestion[]; usedWords: Word[] }> {
  const selected = pick(words, count)
  const wordList = selected.map((w) => `${w.chinese} (${w.pinyin}) = ${w.english}`).join('\n')
  const system = `You are an HSK 4 exam writer. Generate ${count} ${kind} comprehension questions. Each question uses a short Chinese passage (3-4 sentences) built around one of the given HSK 4 words. Return ONLY a JSON array, no markdown. Each element: {"passage":"中文段落","question":"问题?","options":["A","B","C","D"],"answer":"correct option text","word":"目标词"}.`
  const user = `Words to use (one per question):\n${wordList}\n\nGenerate ${count} questions. The "answer" must be one of the options verbatim. All Chinese must be natural HSK 4 level.`

  try {
    const raw = await callLLM(system, user, { temperature: 0.6, max_tokens: 2048 })
    // Extract JSON array from response (tolerate stray text)
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array in AI response')
    const parsed = JSON.parse(match[0]) as AIPassageQuestion[]
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty AI response')
    return { questions: parsed.slice(0, count), usedWords: selected }
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn('[Exam] AI passage generation failed, falling back to algorithmic', err)
    return { questions: [], usedWords: selected }
  }
}

interface AIPictureQuestion {
  sceneDescription: string
  targetWord: string
  expectedSentence: string
  expectedEnglish: string
}

async function genAIPictureQuestions(
  words: Word[],
  count: number,
  signal?: AbortSignal,
): Promise<{ questions: AIPictureQuestion[]; usedWords: Word[] }> {
  const selected = pick(words, count)
  const wordList = selected.map((w) => `${w.chinese} (${w.pinyin}) = ${w.english}`).join('\n')
  const system = `You are an HSK 4 exam writer for the writing section. For each given word, create a picture-description task. The picture should depict a simple everyday scene that naturally involves the word. Return ONLY a JSON array. Each element: {"sceneDescription":"a simple visual scene description in English for image generation, e.g. 'a man ordering food at a restaurant'","targetWord":"中文词","expectedSentence":"一个自然的中文句子 using the target word","expectedEnglish":"English translation"}.`
  const user = `Words:\n${wordList}\n\nGenerate ${count} picture-description tasks.`

  try {
    const raw = await callLLM(system, user, { temperature: 0.7, max_tokens: 1536 })
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array in AI response')
    const parsed = JSON.parse(match[0]) as AIPictureQuestion[]
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty AI response')
    return { questions: parsed.slice(0, count), usedWords: selected }
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn('[Exam] AI picture generation failed, falling back to algorithmic', err)
    return { questions: [], usedWords: selected }
  }
}

function buildPictureUrl(sceneDescription: string): string {
  const prompt = encodeURIComponent(`${sceneDescription}, simple illustration, flat style, no text`)
  return `https://image.pollinations.ai/prompt/${prompt}?width=400&height=300&nologo=true`
}

// ── Section builders ─────────────────────────────────────────────

async function buildListeningSection(
  plan: SectionPlan,
  words: Word[],
  signal?: AbortSignal,
): Promise<ExamQuestion[]> {
  const questions: ExamQuestion[] = []
  let pool = [...words]

  // Part 1: True/False (algorithmic)
  const tfWords = pick(pool, plan.listeningTF)
  pool = pool.filter((w) => !tfWords.includes(w))
  questions.push(...genListeningTF(tfWords, plan.listeningTF))

  // Part 2: Dialogue MCQ (algorithmic)
  const dlgWords = pick(pool, plan.listeningDialogue)
  pool = pool.filter((w) => !dlgWords.includes(w))
  questions.push(...genListeningDialogueMCQ(dlgWords, plan.listeningDialogue))

  // Part 3: Passage MCQ (AI, fallback to dialogue MCQ)
  if (plan.listeningPassage > 0) {
    const passageWords = pick(pool, plan.listeningPassage)
    pool = pool.filter((w) => !passageWords.includes(w))
    const ai = await genAIPassageQuestions(passageWords, plan.listeningPassage, 'listening', signal)
    if (ai.questions.length > 0) {
      ai.questions.forEach((q, i) => {
        const word = passageWords[i] || passageWords[0]
        questions.push({
          id: uid('lpsg', i),
          section: 'listening',
          type: 'listening-mcq',
          prompt: `Listen to the passage. ${q.question}`,
          audioText: q.passage,
          passage: q.passage,
          options: q.options,
          correctAnswer: q.answer,
          word,
        })
      })
    } else {
      // Fallback: algorithmic dialogue MCQ
      questions.push(...genListeningDialogueMCQ(passageWords, plan.listeningPassage))
    }
  }

  return questions
}

async function buildReadingSection(
  plan: SectionPlan,
  words: Word[],
  signal?: AbortSignal,
): Promise<ExamQuestion[]> {
  const questions: ExamQuestion[] = []
  let pool = [...words]

  // Part 1: Cloze (algorithmic)
  const clozeWords = pick(pool, plan.readingCloze)
  pool = pool.filter((w) => !clozeWords.includes(w))
  questions.push(...genReadingCloze(clozeWords, plan.readingCloze))

  // Part 2: Match (algorithmic)
  const matchWords = pick(pool, plan.readingMatch)
  pool = pool.filter((w) => !matchWords.includes(w))
  questions.push(...genReadingMatch(matchWords, plan.readingMatch))

  // Part 3: Passage MCQ (AI, fallback to match)
  if (plan.readingPassage > 0) {
    const passageWords = pick(pool, plan.readingPassage)
    pool = pool.filter((w) => !passageWords.includes(w))
    const ai = await genAIPassageQuestions(passageWords, plan.readingPassage, 'reading', signal)
    if (ai.questions.length > 0) {
      ai.questions.forEach((q, i) => {
        const word = passageWords[i] || passageWords[0]
        questions.push({
          id: uid('rpsg', i),
          section: 'reading',
          type: 'reading-mcq',
          prompt: `Read the passage and answer: ${q.question}`,
          passage: q.passage,
          options: q.options,
          correctAnswer: q.answer,
          word,
        })
      })
    } else {
      questions.push(...genReadingMatch(passageWords, plan.readingPassage))
    }
  }

  return questions
}

async function buildWritingSection(
  plan: SectionPlan,
  words: Word[],
  signal?: AbortSignal,
): Promise<ExamQuestion[]> {
  const questions: ExamQuestion[] = []
  let pool = [...words]

  // Part 1: Reorder (algorithmic)
  const reorderWords = pick(pool, plan.writingReorder)
  pool = pool.filter((w) => !reorderWords.includes(w))
  questions.push(...genWritingReorder(reorderWords, plan.writingReorder))

  // Part 2: Picture description (AI, fallback to reorder)
  if (plan.writingPicture > 0) {
    const picWords = pick(pool, plan.writingPicture)
    pool = pool.filter((w) => !picWords.includes(w))
    const ai = await genAIPictureQuestions(picWords, plan.writingPicture, signal)
    if (ai.questions.length > 0) {
      ai.questions.forEach((q, i) => {
        const word = picWords[i] || picWords[0]
        questions.push({
          id: uid('wpic', i),
          section: 'writing',
          type: 'writing-picture',
          prompt: `Look at the picture and write a sentence using the word 「${q.targetWord}」.`,
          imageUrl: buildPictureUrl(q.sceneDescription),
          targetWord: q.targetWord,
          correctAnswer: q.expectedSentence,
          acceptableAnswers: [q.expectedSentence, q.expectedEnglish],
          word,
        })
      })
    } else {
      // Fallback: extra reorder questions
      questions.push(...genWritingReorder(picWords, plan.writingPicture))
    }
  }

  return questions
}

// ── Public API ───────────────────────────────────────────────────

export async function generateExam(
  length: ExamLength,
  level: HSKLevel,
  signal?: AbortSignal,
): Promise<ExamSection[]> {
  const plan = PLANS[length]
  const allWords = await wordService.getByLevel(level)
  if (allWords.length === 0) throw new Error(`No words found for HSK level ${level}`)

  // Shuffle once so sections pull from different words.
  const shuffled = shuffle(allWords)

  const [listeningQs, readingQs, writingQs] = await Promise.all([
    buildListeningSection(plan, shuffled, signal),
    buildReadingSection(plan, shuffled, signal),
    buildWritingSection(plan, shuffled, signal),
  ])

  const durations = DURATIONS[length]

  return [
    {
      id: 'listening',
      name: 'Listening',
      nameCn: '听力',
      questions: listeningQs,
      durationSec: durations.listening,
    },
    {
      id: 'reading',
      name: 'Reading',
      nameCn: '阅读',
      questions: readingQs,
      durationSec: durations.reading,
    },
    {
      id: 'writing',
      name: 'Writing',
      nameCn: '书写',
      questions: writingQs,
      durationSec: durations.writing,
    },
  ]
}

export function gradeExam(
  sections: ExamSection[],
  answers: Map<string, string>,
  sectionTimes: Record<ExamSectionId, number>,
): ExamResult {
  const questionReviews: ExamQuestionReview[] = []
  const sectionResults = {
    listening: { correct: 0, total: 0, timeTakenSec: sectionTimes.listening || 0 },
    reading: { correct: 0, total: 0, timeTakenSec: sectionTimes.reading || 0 },
    writing: { correct: 0, total: 0, timeTakenSec: sectionTimes.writing || 0 },
  }

  let correctCount = 0
  let totalQuestions = 0

  for (const section of sections) {
    for (const q of section.questions) {
      totalQuestions++
      sectionResults[section.id].total++
      const userAnswer = answers.get(q.id) || ''
      let correct: boolean

      if (q.type === 'writing-reorder' || q.type === 'writing-picture') {
        // Text input — fuzzy match
        correct = isAnswerCorrect(userAnswer, q.correctAnswer)
        if (!correct && q.acceptableAnswers) {
          correct = q.acceptableAnswers.some((a) => isAnswerCorrect(userAnswer, a))
        }
      } else {
        // MCQ / T-F / matching — exact match against correctAnswer
        correct = userAnswer.trim() === q.correctAnswer.trim()
      }

      if (correct) {
        correctCount++
        sectionResults[section.id].correct++
      }

      questionReviews.push({ question: q, userAnswer, correct })
    }
  }

  const score = Math.round((correctCount / Math.max(totalQuestions, 1)) * 300)
  const durationSec = Object.values(sectionResults).reduce((sum, s) => sum + s.timeTakenSec, 0)

  return {
    totalQuestions,
    correctCount,
    score,
    passed: score >= 180,
    sectionResults,
    durationSec,
    questionReviews,
  }
}
