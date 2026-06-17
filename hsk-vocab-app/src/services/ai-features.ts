// AI-powered learning features — shared prompt functions and type definitions.
// Uses the unified LLM dispatcher (llm.ts) for local/server routing.

import { Word, UserProgress, StudySession } from '@/types'
import { chat, ChatMessage } from './llm'
import { useSettingsStore } from '@/stores'

// ── Helpers ──────────────────────────────────────────────────────

function getLlmMode(): 'auto' | 'local' | 'server' {
  try {
    return useSettingsStore.getState().llmMode
  } catch {
    return 'auto'
  }
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; max_tokens?: number } = {},
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  const result = await chat(messages, getLlmMode(), {
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.max_tokens ?? 512,
  })
  return result.content
}

function buildWordContext(words: Word[], maxWords = 30): string {
  if (!words.length) return ''
  return words.slice(0, maxWords)
    .map((w) => `${w.chinese} (${w.pinyin}) = ${w.english} [HSK ${w.hsk_level}, ${Array.isArray(w.pos) ? w.pos.join('/') : ''}]`)
    .join('\n')
}

// ── #3 Grammar Breakdown ─────────────────────────────────────────

export interface GrammarBreakdown {
  word: string
  pinyin: string
  meaning: string
  usage: string
  grammarPoints: string[]
  exampleSentences: string[]
}

export async function generateGrammarBreakdown(
  word: Word,
  userAnswer: string,
  correctAnswer: string,
): Promise<GrammarBreakdown> {
  const prompt = `The student got this word wrong in a quiz. Explain WHY the correct answer is right, and teach the grammar/usage pattern.

Word: ${word.chinese} (${word.pinyin})
Meaning: ${word.english}
HSK Level: ${word.hsk_level}
Part of speech: ${Array.isArray(word.pos) ? word.pos.join('/') : 'unknown'}

Student's wrong answer: "${userAnswer}"
Correct answer: "${correctAnswer}"

Provide a brief, friendly explanation focusing on the grammar or usage pattern. Return ONLY valid JSON:
{
  "word": "${word.chinese}",
  "pinyin": "${word.pinyin}",
  "meaning": "concise meaning",
  "usage": "1-2 sentence explanation of how this word is used and why the student's answer was wrong",
  "grammarPoints": ["key grammar tip 1", "key grammar tip 2"],
  "exampleSentences": ["correct example sentence with pinyin and translation"]
}

Keep it CONCISE — under 150 words total. Focus on what the student needs to know to get it right next time.`

  const content = await callLLM(
    'You are a Chinese language teacher. Respond with valid JSON only. Be concise and helpful.',
    prompt,
    { temperature: 0.3, max_tokens: 400 },
  )

  try {
    const json = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
    return {
      word: json.word || word.chinese,
      pinyin: json.pinyin || word.pinyin,
      meaning: json.meaning || word.english,
      usage: json.usage || `${word.chinese} means "${word.english}".`,
      grammarPoints: json.grammarPoints || [],
      exampleSentences: json.exampleSentences || [],
    }
  } catch {
    return {
      word: word.chinese,
      pinyin: word.pinyin,
      meaning: word.english,
      usage: `${word.chinese} (${word.pinyin}) means "${word.english}".`,
      grammarPoints: [],
      exampleSentences: [],
    }
  }
}

// ── #2 Story Generator ───────────────────────────────────────────

export interface StoryQuestion {
  question: string
  options: string[]
  correctIndex: number
}

export interface GeneratedStory {
  title: string
  storyChinese: string
  storyPinyin: string
  storyEnglish: string
  targetWords: string[]
  questions: StoryQuestion[]
}

export async function generateStory(
  level: number,
  words: Word[],
  wordCount: number,
): Promise<GeneratedStory> {
  const levelWords = words.filter((w) => w.hsk_level === level)
  const selected = [...levelWords].sort(() => Math.random() - 0.5).slice(0, wordCount)
  const wordList = selected.map((w) => `${w.chinese} (${w.pinyin}) = ${w.english}`).join('\n')

  const prompt = `Create a short, engaging Chinese story for HSK ${level} learners using these target words:

${wordList}

Requirements:
- Story should be 8-15 sentences, natural and interesting
- Use ALL the target words at least once
- Keep grammar appropriate for HSK ${level}
- Include 3 comprehension questions (multiple choice, 4 options each)

Return ONLY valid JSON:
{
  "title": "Story title in English",
  "storyChinese": "Full story in Chinese characters",
  "storyPinyin": "Full story in pinyin with tone marks",
  "storyEnglish": "Full story in English translation",
  "targetWords": ["word1", "word2", ...],
  "questions": [
    {
      "question": "Question in English about the story",
      "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
      "correctIndex": 0
    }
  ]
}`

  const content = await callLLM(
    'You create engaging Chinese stories for language learners. Respond with valid JSON only.',
    prompt,
    { temperature: 0.7, max_tokens: 1024 },
  )

  try {
    return JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
  } catch {
    throw new Error('Failed to generate story')
  }
}

// ── #7 Word Relationships ────────────────────────────────────────

export interface RelationItem {
  chinese: string
  pinyin: string
  english: string
}

export interface WordRelations {
  synonyms: RelationItem[]
  antonyms: RelationItem[]
  collocations: RelationItem[]
  relatedWords: RelationItem[]
  usageNote: string
}

export async function generateWordRelations(word: Word, allWords: Word[]): Promise<WordRelations> {
  const sameLevelWords = allWords
    .filter((w) => w.hsk_level === word.hsk_level && w.id !== word.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 20)
  const context = buildWordContext(sameLevelWords, 20)

  // Build a lookup table so we can fill in pinyin/english for words the
  // LLM returns that exist in our vocabulary database.
  const lookup = new Map<string, Word>()
  for (const w of allWords) {
    lookup.set(w.chinese, w)
    lookup.set(w.chinese.replace(/[，。、！？：；]/g, ''), w)
  }

  const prompt = `Analyze this Chinese word and find its relationships:

Word: ${word.chinese} (${word.pinyin})
Meaning: ${word.english}
HSK Level: ${word.hsk_level}
Part of speech: ${Array.isArray(word.pos) ? word.pos.join('/') : 'unknown'}

Nearby vocabulary (same level):
${context}

Return ONLY valid JSON in exactly this format:
{
  "synonyms": [{"chinese":"白日","pinyin":"bái rì","english":"daytime"}],
  "antonyms": [{"chinese":"黑夜","pinyin":"hēi yè","english":"night"}],
  "collocations": [{"chinese":"白天工作","pinyin":"bái tiān gōng zuò","english":"work during the day"}],
  "relatedWords": [{"chinese":"上午","pinyin":"shàng wǔ","english":"morning"}],
  "usageNote": "One short sentence in Chinese (≤ 30 chars) explaining when/how to use this word."
}

Rules:
- Provide pinyin with tone marks for every item.
- Only include REAL Chinese vocabulary.
- 2-4 items per category. Use empty arrays for categories with no real entries.
- Respond with JSON only, no prose or markdown fences.`

  const content = await callLLM(
    'You are a Chinese linguistics expert. Respond with valid JSON only, no markdown.',
    prompt,
    { temperature: 0.3, max_tokens: 700 },
  )

  const parsed = parseWordRelations(content)
  return {
    synonyms: parsed.synonyms.map((it) => fillRelationItem(it, lookup)),
    antonyms: parsed.antonyms.map((it) => fillRelationItem(it, lookup)),
    collocations: parsed.collocations.map((it) => fillRelationItem(it, lookup)),
    relatedWords: parsed.relatedWords.map((it) => fillRelationItem(it, lookup)),
    usageNote: parsed.usageNote,
  }
}

function parseWordRelations(content: string): {
  synonyms: string[]
  antonyms: string[]
  collocations: string[]
  relatedWords: string[]
  usageNote: string
} {
  // Strip markdown fences if the LLM ignored the "no fences" instruction
  const cleaned = content
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim()
  try {
    const obj = JSON.parse(cleaned)
    return {
      synonyms: Array.isArray(obj.synonyms) ? obj.synonyms.map(toRelationInput).filter(Boolean) : [],
      antonyms: Array.isArray(obj.antonyms) ? obj.antonyms.map(toRelationInput).filter(Boolean) : [],
      collocations: Array.isArray(obj.collocations) ? obj.collocations.map(toRelationInput).filter(Boolean) : [],
      relatedWords: Array.isArray(obj.relatedWords) ? obj.relatedWords.map(toRelationInput).filter(Boolean) : [],
      usageNote: typeof obj.usageNote === 'string' ? obj.usageNote : '',
    }
  } catch {
    return { synonyms: [], antonyms: [], collocations: [], relatedWords: [], usageNote: '' }
  }
}

function toRelationInput(v: any): string {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && typeof v.chinese === 'string') return v.chinese
  return ''
}

function fillRelationItem(chinese: string, lookup: Map<string, Word>): RelationItem {
  // Try to enrich the LLM's output by looking the word up in our DB.
  // This gives reliable pinyin + English for the 2000 words in our
  // vocabulary list, even when the LLM's pinyin/english is approximate.
  const fromDb = lookup.get(chinese)
  if (fromDb) {
    return { chinese: fromDb.chinese, pinyin: fromDb.pinyin, english: fromDb.english }
  }
  return { chinese, pinyin: '', english: '' }
}

// ── #8 Daily Digest ──────────────────────────────────────────────

export interface DailyDigest {
  summary: string
  strengths: string[]
  weaknesses: string[]
  focusAreas: string[]
  motivationalMessage: string
}

export async function generateDailyDigest(
  todayStats: { wordsStudied: number; accuracy: number; duration: number },
  weakWords: Word[],
  streakDays: number,
  totalLearned: number,
  level: number,
): Promise<DailyDigest> {
  const weakList = weakWords.slice(0, 10).map((w) => `${w.chinese} (${w.pinyin}) = ${w.english}`).join('\n')

  const prompt = `Generate a personalized daily study digest for an HSK student.

Today's stats:
- Words studied: ${todayStats.wordsStudied}
- Accuracy: ${todayStats.accuracy}%
- Study time: ${Math.round(todayStats.duration / 60)} minutes
- Current streak: ${streakDays} days
- Total words learned: ${totalLearned}
- Current HSK level: ${level}

Weak words (need review):
${weakList || 'None identified'}

Return ONLY valid JSON:
{
  "summary": "1-2 sentence summary of today's performance",
  "strengths": ["what went well", "another strength"],
  "weaknesses": ["area to improve", "another area"],
  "focusAreas": ["specific topic to focus on tomorrow", "another focus"],
  "motivationalMessage": "short encouraging message in a friendly tone"
}

Be encouraging and specific. Use the student's actual data. Keep it concise.`

  const content = await callLLM(
    'You are an encouraging Chinese language coach. Respond with valid JSON only.',
    prompt,
    { temperature: 0.5, max_tokens: 400 },
  )

  try {
    return JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
  } catch {
    return {
      summary: `You studied ${todayStats.wordsStudied} words today with ${todayStats.accuracy}% accuracy.`,
      strengths: ['Consistent practice'],
      weaknesses: ['Keep reviewing weak words'],
      focusAreas: ['Review weak words', 'Practice more'],
      motivationalMessage: 'Keep going! Every day of practice brings you closer to fluency.',
    }
  }
}

// ── #5 Conversation Partner ──────────────────────────────────────

export interface ConversationTurn {
  role: 'partner' | 'user'
  content: string
  pinyin?: string
  translation?: string
  corrections?: string[]
}

export interface ConversationScenario {
  id: string
  title: string
  description: string
  level: number
  icon: string
  systemPrompt: string
}

export const CONVERSATION_SCENARIOS: ConversationScenario[] = [
  {
    id: 'restaurant',
    title: 'At a Restaurant',
    description: 'Order food, ask about the menu, pay the bill',
    level: 1,
    icon: '🍜',
    systemPrompt: `You are a friendly waiter at a Chinese restaurant. The student is a customer who wants to order food. 

Rules:
- Speak in Chinese appropriate for HSK 1-2 level
- After each of your responses, provide the pinyin and English translation in this format:
  [PY: pinyin here]
  [EN: English translation here]
- If the student makes a grammar mistake, gently correct it by repeating what they said correctly
- Keep the conversation natural and flowing
- Ask questions to keep the conversation going (e.g., "What would you like to drink?", "Any dessert?")
- Keep your Chinese sentences short (5-12 characters)
- Use ONLY HSK 1-2 vocabulary`,
  },
  {
    id: 'shopping',
    title: 'Shopping',
    description: 'Buy clothes, ask about prices, bargain',
    level: 2,
    icon: '🛍️',
    systemPrompt: `You are a shop assistant at a clothing store in Beijing. The student is a customer shopping for clothes.

Rules:
- Speak in Chinese appropriate for HSK 2-3 level
- After each of your responses, provide the pinyin and English translation
- If the student makes a grammar mistake, gently correct it
- Ask about size, color preferences, and budget
- Be friendly and helpful
- Keep sentences at 8-18 characters`,
  },
  {
    id: 'taxi',
    title: 'Taking a Taxi',
    description: 'Give directions, discuss the route, pay',
    level: 2,
    icon: '🚕',
    systemPrompt: `You are a taxi driver in Shanghai. The student is a passenger.

Rules:
- Speak in Chinese appropriate for HSK 2-3 level
- After each response, provide pinyin and English translation
- Ask about destination, preferred route, and if they need help with luggage
- Make small talk about the weather or their day
- Keep sentences at 8-18 characters`,
  },
  {
    id: 'doctor',
    title: 'At the Doctor',
    description: 'Describe symptoms, understand advice, get medicine',
    level: 3,
    icon: '🏥',
    systemPrompt: `You are a doctor at a Chinese hospital. The student is a patient.

Rules:
- Speak in Chinese appropriate for HSK 3-4 level
- After each response, provide pinyin and English translation
- Ask about symptoms, how long they've felt unwell, and medical history
- Give clear advice about rest, medicine, and follow-up
- Be professional but caring
- Keep sentences at 10-20 characters`,
  },
  {
    id: 'interview',
    title: 'Job Interview',
    description: 'Introduce yourself, discuss experience, ask questions',
    level: 4,
    icon: '💼',
    systemPrompt: `You are a hiring manager at a Chinese company. The student is a job applicant.

Rules:
- Speak in Chinese appropriate for HSK 4 level
- After each response, provide pinyin and English translation
- Ask about their experience, strengths, weaknesses, and career goals
- Be professional and formal
- Use some business vocabulary
- Keep sentences at 12-25 characters`,
  },
]

export async function generateConversationResponse(
  scenario: ConversationScenario,
  history: ConversationTurn[],
  userMessage: string,
): Promise<ConversationTurn> {
  const historyText = history
    .map((t) => `${t.role === 'partner' ? 'Waiter/Assistant' : 'Student'}: ${t.content}`)
    .join('\n')

  const prompt = `${scenario.systemPrompt}

Conversation so far:
${historyText}

Student: ${userMessage}

Respond naturally in character. Return ONLY valid JSON:
{
  "content": "Your response in Chinese",
  "pinyin": "Pinyin with tone marks",
  "translation": "English translation",
  "corrections": ["correction if student made a mistake, or empty array"]
}`

  const content = await callLLM(
    'You are a Chinese conversation partner. Respond with valid JSON only.',
    prompt,
    { temperature: 0.7, max_tokens: 400 },
  )

  try {
    const json = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
    return {
      role: 'partner',
      content: json.content || '好的！',
      pinyin: json.pinyin,
      translation: json.translation,
      corrections: json.corrections || [],
    }
  } catch {
    return {
      role: 'partner',
      content: '好的！很有意思！',
      pinyin: 'Hǎo de! Hěn yǒu yìsi!',
      translation: 'Okay! Very interesting!',
    }
  }
}

// ── #4 Smart Review ──────────────────────────────────────────────

export interface SmartReviewSession {
  words: Word[]
  explanation: string
  focusAreas: string[]
}

export async function generateSmartReview(
  progress: UserProgress[],
  allWords: Word[],
  sessions: StudySession[],
  level: number,
): Promise<SmartReviewSession> {
  // Build error pattern data
  const weakWordIds = progress
    .filter((p) => p.mastery_level <= 2)
    .sort((a, b) => a.mastery_level - b.mastery_level)
    .slice(0, 15)
    .map((p) => p.word_id)

  const weakWords = weakWordIds
    .map((id) => allWords.find((w) => w.id === id))
    .filter(Boolean) as Word[]

  const weakList = buildWordContext(weakWords, 15)
  const recentAccuracy = sessions.slice(-5).map((s) => `${s.mode}: ${s.accuracy}% (${s.words_studied} words)`).join('\n')

  const prompt = `Analyze this HSK student's learning data and create a personalized review session.

HSK Level: ${level}
Weak words: 
${weakList}

Recent session accuracy:
${recentAccuracy || 'No recent sessions'}

Create a smart review plan. Return ONLY valid JSON:
{
  "explanation": "2-3 sentence analysis of the student's error patterns and what to focus on",
  "focusAreas": ["specific grammar/vocabulary area to focus on", "another area"],
  "words": ["word_id1", "word_id2", ...] 
}

For the "words" field, list the word IDs from the weak words list above (up to 10) in priority order — most important to review first. Use the actual word IDs from the input.`

  const content = await callLLM(
    'You are an HSK study coach analyzing student data. Respond with valid JSON only.',
    prompt,
    { temperature: 0.3, max_tokens: 512 },
  )

  try {
    const json = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
    const selectedIds: string[] = json.words || []
    const selectedWords = selectedIds
      .map((id: string) => allWords.find((w) => w.id === id))
      .filter(Boolean) as Word[]

    return {
      words: selectedWords.length > 0 ? selectedWords : weakWords.slice(0, 10),
      explanation: json.explanation || 'Focus on your weakest words to improve retention.',
      focusAreas: json.focusAreas || [],
    }
  } catch {
    return {
      words: weakWords.slice(0, 10),
      explanation: 'Review these words to strengthen your foundation.',
      focusAreas: ['Vocabulary review'],
    }
  }
}

// ── #6 Handwriting Check ─────────────────────────────────────────

export interface HandwritingFeedback {
  score: number
  feedback: string
  structureIssues: string[]
  strokeOrder: string
  tips: string[]
}

export async function evaluateHandwriting(
  word: Word,
  userAttempt: string, // description of what the user drew
  strokeData: { strokes: number; direction: string } | null,
): Promise<HandwritingFeedback> {
  const prompt = `Evaluate this student's Chinese handwriting attempt.

Target character: ${word.chinese} (${word.pinyin})
Meaning: ${word.english}
Stroke count: ${word.stroke_count}
Radical: ${word.radical}

The student attempted to write "${word.chinese}" and described their attempt as: "${userAttempt}"
${strokeData ? `Stroke data: ${strokeData.strokes} strokes drawn, direction: ${strokeData.direction}` : ''}

Evaluate the handwriting. Consider:
- Correct character structure
- Stroke order
- Proportion and balance
- Common mistakes for this character

Return ONLY valid JSON:
{
  "score": 0-5,
  "feedback": "Brief overall feedback on the handwriting",
  "structureIssues": ["specific issue with structure", "another issue"],
  "strokeOrder": "Description of the correct stroke order",
  "tips": ["specific tip to improve", "another tip"]
}

Be encouraging but honest. Score 5 = perfect, 4 = good with minor issues, 3 = recognizable but needs work, 2 = significant errors, 1 = barely recognizable, 0 = wrong character.`

  const content = await callLLM(
    'You are a Chinese calligraphy teacher. Respond with valid JSON only.',
    prompt,
    { temperature: 0.3, max_tokens: 400 },
  )

  try {
    return JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
  } catch {
    return {
      score: 3,
      feedback: 'Keep practicing! Try to write the character more clearly.',
      structureIssues: [],
      strokeOrder: `The correct stroke order for ${word.chinese} starts from top to bottom, left to right.`,
      tips: ['Practice writing slowly and carefully', 'Pay attention to the proportions of each component'],
    }
  }
}