import { Word } from '@/types'
import { wordService, getWeakWords, getUserProgress, getUserProfile } from './sqlite-api'
import { supabaseVocab } from './supabase-db'
import { isSupabaseConfigured } from './supabase'
import { AIMode, CONVERSATION_SYSTEM_PROMPT, GRAMMAR_SYSTEM_PROMPT } from '@/data/aiModes'

// ── AI Backend configuration ──
// The browser NEVER talks to DeepSeek directly. All chat completions go
// through this app's serverless proxy at /api/ai/chat, which holds the
// DEEPSEEK_API_KEY server-side. This prevents the key from being
// shipped to visitors in the JS bundle.
// Priority:
//   1. VITE_AI_BACKEND_URL → custom backend/proxy (rare)
//   2. /api/ai/chat         → the Vercel serverless proxy in this repo
function getBackendConfig(): { url: string; apiKey?: string; authHeader: () => Record<string, string> } {
  const backendUrl = import.meta.env.VITE_AI_BACKEND_URL as string | undefined;
  if (backendUrl) {
    return { url: backendUrl, authHeader: () => ({}) }
  }
  return { url: '/api/ai/chat', authHeader: () => ({}) }
}
const AI_BACKEND = getBackendConfig()
const AI_MODEL = 'deepseek-chat'
const MAX_RETRIES = 1
const REQUEST_TIMEOUT = 15000

// Cache vocabulary in memory to avoid reloading every request
let cachedVocab: Word[] | null = null

async function getVocab(): Promise<Word[]> {
  if (!cachedVocab) {
    try {
      if (isSupabaseConfigured()) {
        cachedVocab = await supabaseVocab.getAll()
      } else {
        cachedVocab = await wordService.getAll()
      }
    } catch {
      cachedVocab = []
    }
  }
  return cachedVocab
}

// Build a compact context string from vocabulary — only include relevant words
function buildVocabContext(words: Word[], userQuery: string): string {
  if (!words.length) return ''

  const q = userQuery.toLowerCase().trim()

  // For simple greetings or short questions, no vocab needed
  if (q.length <= 15 && /^(hi|hello|hey|你好|好|谢谢|thanks|ok|yes|no|nope|yep)/i.test(q)) {
    return ''
  }

  // Figure out what the user is asking for
  const wantsTable = /table|compare|list|all|every/i.test(q)
  const wantsFlowChart = /flow.?chart|diagram|mind.?map|timeline|visual/i.test(q)
  const wantsQuiz = /quiz|test|practice|random/i.test(q)
  const wantsLevel = q.match(/hsk\s*([1-4])/i)

  // Select relevant words — max 50 to keep context small
  let selected: Word[] = []

  if (wantsLevel) {
    // Filter by specific HSK level
    selected = words.filter((w) => w.hsk_level === parseInt(wantsLevel[1])).slice(0, 50)
  } else if (wantsTable || wantsQuiz) {
    // Get a good mix across all levels
    const byLevel: Record<number, Word[]> = {}
    for (const w of words) {
      if (!byLevel[w.hsk_level]) byLevel[w.hsk_level] = []
      byLevel[w.hsk_level].push(w)
    }
    for (const lvl in byLevel) {
      selected.push(...byLevel[lvl].slice(0, 12))
    }
  } else {
    // For specific word queries, find matching words
    const chineseChars = q.match(/[\u4e00-\u9fff]+/g) || []
    const englishWords = q.toLowerCase().split(/\s+/).filter((w) => w.length > 3)

    const matches = words.filter((w) => {
      if (chineseChars.some((c) => w.chinese.includes(c))) return true
      if (englishWords.some((e) => w.english.toLowerCase().includes(e))) return true
      return false
    })

    if (matches.length > 0) {
      selected = matches.slice(0, 20)
    } else {
      // Send a small representative sample — 3 from each HSK level
      const byLevel: Record<number, Word[]> = {}
      for (const w of words) {
        if (!byLevel[w.hsk_level]) byLevel[w.hsk_level] = []
        byLevel[w.hsk_level].push(w)
      }
      for (const lvl in byLevel) {
        selected.push(...byLevel[lvl].slice(0, 3))
      }
    }
  }

  if (selected.length === 0) return ''

  // Compact format — one line per word, no redundant info
  const lines = selected.map((w) => {
    return `${w.chinese} ${w.pinyin} ${w.english} HSK${w.hsk_level}`
  })

  const flags: string[] = []
  if (wantsTable) flags.push('TABLE_REQUESTED')
  if (wantsFlowChart) flags.push('DIAGRAM_REQUESTED')
  if (wantsQuiz) flags.push('QUIZ_REQUESTED')

  const flagsStr = flags.length > 0 ? `\nRequest type: ${flags.join(', ')}` : ''

  return `[Vocab Reference — only use words from this list]:
${lines.join('\n')}${flagsStr}

Use ONLY words from the list above. Do NOT invent words. If a word is not in the list, say so.`
}

const SYSTEM_PROMPT = `You are 小明 (Xiǎo Míng), a Chinese language tutor who genuinely loves helping people learn. You talk like a real person — warm, a bit playful, never robotic. You should ONLY identify as 小明 (Xiǎo Míng). Never mention any AI model, API, or technology you run on — not DeepSeek, not GPT, not Claude, not any model name. You are simply 小明.

Core rules:
- When explaining a Chinese word, always show: **character** (pinyin) - meaning · HSK level
- Respond primarily in the same language the user uses
  - If user writes in English: answer in English. Show Chinese characters and pinyin only when explaining Chinese words
  - If user writes in Chinese: answer in Chinese. Show English meaning only when explaining the English meaning.
- Use markdown for clarity
- For quiz requests, create multiple-choice with 4 options (A/B/C/D)
- **BE CONCISE.** Give short, direct answers. Only explain in detail when someone asks "why", "how", or requests a full explanation. If they ask "what does X mean?", just give the meaning with one short example. Don't add extra context, history, or background unless specifically asked.
- **IMPORTANT: If the user has selected a personalized plan, actively help them stay on track.** Mention their daily goal, suggest relevant content for their level, and give study tips based on their learning reason. If they're preparing for HSK, focus on exam strategies. If they're learning for conversation, focus on practical phrases.

Table and diagram rules — use these ONLY when the question clearly calls for organized or visual information:
- **USE MARKDOWN TABLES** when specifically asked to compare vocabulary, show grammar patterns, list words by level, or any structured comparison. Tables should have clear headers.
- Example table format:
  | Chinese | Pinyin | Meaning | HSK |
  |---|---|---|---|
  | 你好 | nǐ hǎo | hello | 1 |
- **USE MERMAID FLOW CHARTS** only when someone explicitly asks for a flow chart, diagram, or visual learning path. Wrap mermaid code in \`\`\`mermaid ... \`\`\`
- Example mermaid format:
  \`\`\`mermaid
  flowchart LR
    A[Start] --> B[Step 1]
    B --> C[Step 2]
    C --> D[End]
  \`\`\`
- You can also use mermaid for mind maps (mindmap), timelines (timeline), or comparison diagrams.
- Do NOT create tables or diagrams for simple questions — just answer directly.

Anti-bot rules — NEVER do these:
- Don't end responses with: "Want me to...?", "Would you like to...?", "Shall I...?", "Feel free to ask!", "Let me know if you need anything!", "Happy to help!", "Would you like to know more?", or anything like this
- Don't end with a bullet list followed by an invitation question — that's a template
- Don't list bullet-point menus of things you can do
- Each response must feel like one person texting another — natural, conversational, to the point
- Never use "—" (em dash) or "#" (hash) characters. For word formatting, use simple parentheses like: 你好 (nǐ hǎo) - hello · HSK 1
- IMPORTANT: Never claim a specific word is the "Nth word" in an HSK level, or claim a specific position/order for any vocabulary word. If asked about ordering, say you don't have the exact ordered list and describe the word instead.
- Never make up facts about specific word positions, lesson numbers, or exact ordering from HSK lists. The AI may have fuzzy recall of HSK content but NOT precise ordering.

Personality:
- If someone says hi, greet them like a friend and maybe teach a quick phrase
- If someone asks "can I learn Chinese?", be genuinely encouraging and share something motivating right away
- If you don't know something, say so honestly
- Drop in Chinese phrases naturally when they fit
- Expert in HSK 1-4 grammar — give real, useful explanations

Context vocabulary and grammar below is YOUR reference only. Don't dump it back at the user — use it to give better answers.`

// Build user context from localStorage onboarding data
function buildUserContext(userName?: string): string {
  try {
    const completed = localStorage.getItem('onboarding_complete');
    if (!completed) return '';
    const level = parseInt(localStorage.getItem('hsk_level') || '1');
    const reason = localStorage.getItem('learning_reason') || '';
    const goal = parseInt(localStorage.getItem('daily_goal') || '20');
    const plan = localStorage.getItem('personalized_plan') === 'true';

    if (!plan) return '';

    const levelLabel = level === 0 ? 'Beginner' : `HSK ${level}`;
    const reasonLabels: Record<string, string> = {
      hsk_exam: 'preparing for the HSK exam',
      conversation: 'learning for everyday conversation',
      travel: 'learning for travel in China',
      culture: 'interested in Chinese culture and media',
      work: 'learning for work/business',
      other: 'learning for personal interest',
    };
    const reasonText = reasonLabels[reason] || 'learning Chinese';

    return `[User Profile — personalize responses based on this]:
${userName ? `The user's name is ${userName}. Address them by name occasionally when it feels natural (e.g. greeting, encouragement). ` : ""}The user's current level is ${levelLabel}. They are ${reasonText}. Their daily goal is ${goal} words per day.

Use this to:
- Suggest content and vocabulary at the right difficulty level
- Give study tips relevant to their goal (exam prep, conversation, travel, etc.)
- If they ask about study plans, create one tailored to their level and goal
- Be encouraging about their progress relative to their daily goal
- For HSK exam prep: focus on test strategies, grammar patterns, and exam vocabulary
- For conversation: focus on practical phrases, pronunciation, and natural speech
- For travel: focus on survival Chinese, directions, ordering food, etc.
- For culture: weave in cultural context when explaining words and phrases
- For work: focus on business vocabulary and formal expressions
- Keep suggestions appropriate for their HSK level

Do NOT explicitly mention "your profile says" or "according to your settings" — just naturally personalize your responses.`;
  } catch {
    return '';
  }
}

// Build user progress context — actual study data
async function buildUserProgressContext(userId: string, isGuest: boolean): Promise<string> {
  if (isGuest) return ''; // no DB data for guests

  try {
    const [profile, progress, weakWords] = await Promise.all([
      getUserProfile(userId).catch(() => null),
      getUserProgress(userId).catch(() => []),
      getWeakWords(userId, 5).catch(() => []),
    ])

    const streak = profile?.streak_count ?? 0
    const totalLearned = progress.length
    const totalMastered = progress.filter((p) => p.mastery_level >= 4).length

    // Mastery distribution
    const masteryCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const p of progress) {
      const lvl = Math.max(0, Math.min(5, p.mastery_level ?? 0))
      masteryCounts[lvl] = (masteryCounts[lvl] || 0) + 1
    }

    const weakList = weakWords.length > 0
      ? weakWords.map((w) => `${w.chinese} (${w.english.split(';')[0]})`).join(', ')
      : 'None'

    return `[User Progress — use this to give targeted, encouraging answers]:
- Current streak: ${streak} day${streak === 1 ? '' : 's'}
- Total words in progress: ${totalLearned}
- Words mastered (level 4+): ${totalMastered}
- Mastery distribution: new/learning=${masteryCounts[0] + masteryCounts[1]}, familiar=${masteryCounts[2]}, familiar+=${masteryCounts[3]}, strong=${masteryCounts[4]}, mastered=${masteryCounts[5]}
- Weak words needing review: ${weakList}

Use this to:
- Reference the user's weak words when relevant (e.g. "you've been practicing X — let's reinforce it")
- Celebrate streaks and progress when it feels natural
- Suggest reviewing weak words instead of always introducing new ones
- Avoid re-teaching words the user has mastered unless they ask
- If the user is struggling, suggest the relevant learning mode (flashcard, smart review)
- Never dump this data back at the user — use it to give better answers

If the user asks "what should I study?" or "make me a plan", reference the weak words list.`
  } catch {
    return ''
  }
}

// Scan the AI response for vocabulary words the user knows about
function extractWordsFromResponse(text: string, vocab: Word[]): Word[] {
  if (!vocab.length || !text) return []

  const found = new Map<string, Word>()

  // First pass: exact word matches (longest first to match multi-char words first)
  const sortedVocab = [...vocab].sort((a, b) => b.chinese.length - a.chinese.length)
  for (const w of sortedVocab) {
    if (w.chinese.length < 1) continue
    if (text.includes(w.chinese)) {
      if (!found.has(w.chinese)) {
        found.set(w.chinese, w)
      }
    }
  }

  // Return top N words, prioritized by HSK level (lower levels = more common = more useful for cards)
  return Array.from(found.values())
    .sort((a, b) => a.hsk_level - b.hsk_level)
    .slice(0, 6)
}

export interface GrammarPattern {
  name: string
  nameEn: string
  structure: string
  level: number
  keywords: string[]
  examples: string[]
}

export const GRAMMAR_PATTERNS: GrammarPattern[] = [
  {
    name: '虽然…但是',
    nameEn: 'although...but',
    structure: '虽然 + [clause], 但是/可是 + [clause]',
    level: 3,
    keywords: ['虽然', '但是', '可是', 'although', 'but'],
    examples: [
      '虽然很累，但是我还要学习。(Suīrán hěn lèi, dànshì wǒ hái yào xuéxí.) — Although tired, I still need to study.',
      '虽然下雨，但是他去了。(Suīrán xiàyǔ, dànshì tā qù le.) — Although it rained, he went.',
    ],
  },
  {
    name: '不但…而且',
    nameEn: 'not only...but also',
    structure: '不但 + [clause], 而且 + [clause]',
    level: 4,
    keywords: ['不但', '而且', 'not only', 'but also'],
    examples: [
      '他不但聪明，而且努力。(Tā bùdàn cōngmíng, érqiě nǔlì.) — He is not only smart but also hardworking.',
      '她不但会说中文，而且写得很好。(Tā bùdàn huì shuō Zhōngwén, érqiě xiě de hěn hǎo.) — She not only speaks Chinese but also writes well.',
    ],
  },
  {
    name: '越…越',
    nameEn: 'the more...the more',
    structure: '越 + [adj/verb], 越 + [adj/verb]',
    level: 3,
    keywords: ['越', 'the more'],
    examples: [
      '越学越有意思。(Yuè xué yuè yǒu yìsi.) — The more you study, the more interesting it becomes.',
      '天气越来越冷了。(Tiānqì yuè lái yuè lěng le.) — The weather is getting colder and colder.',
    ],
  },
  {
    name: '被字句',
    nameEn: 'passive voice (bèi)',
    structure: '[receiver] + 被 + [doer] + [verb] + [complement]',
    level: 4,
    keywords: ['被', 'passive', 'bèi'],
    examples: [
      '我的手机被偷了。(Wǒ de shǒujī bèi tōu le.) — My phone was stolen.',
      '他被人骗了。(Tā bèi rén piàn le.) — He was cheated by someone.',
    ],
  },
  {
    name: '把字句',
    nameEn: 'disposal construction (bǎ)',
    structure: '[subject] + 把 + [object] + [verb] + [complement]',
    level: 3,
    keywords: ['把', 'disposal', 'bǎ'],
    examples: [
      '我把书放在桌子上了。(Wǒ bǎ shū fàng zài zhuōzi shàng le.) — I put the book on the table.',
      '请把门关上。(Qǐng bǎ mén guān shàng.) — Please close the door.',
    ],
  },
  {
    name: '是…的',
    nameEn: 'emphasis construction',
    structure: '是 + [emphasized element] + (verb) + 的',
    level: 3,
    keywords: ['是', '的', 'emphasis', 'shì...de'],
    examples: [
      '我是昨天来的。(Wǒ shì zuótiān lái de.) — I came yesterday. (emphasizing when)',
      '他是坐飞机去的。(Tā shì zuò fēijī qù de.) — He went by plane. (emphasizing how)',
    ],
  },
  {
    name: '一边…一边',
    nameEn: 'doing two things simultaneously',
    structure: '一边 + [verb phrase], 一边 + [verb phrase]',
    level: 2,
    keywords: ['一边', 'simultaneously', 'while'],
    examples: [
      '他一边吃饭一边看书。(Tā yìbiān chīfàn yìbiān kànshū.) — He eats while reading.',
      '我一边听音乐一边做作业。(Wǒ yìbiān tīng yīnyuè yìbiān zuò zuòyè.) — I listen to music while doing homework.',
    ],
  },
  {
    name: '既然…就',
    nameEn: 'since...then',
    structure: '既然 + [reason], 就 + [result]',
    level: 4,
    keywords: ['既然', '就', 'since'],
    examples: [
      '既然你不舒服，就休息吧。(Jìrán nǐ bù shūfu, jiù xiūxi ba.) — Since you\'re not well, just rest.',
      '既然来了，就坐下来吧。(Jìrán lái le, jiù zuò xiàlái ba.) — Since you\'re here, sit down.',
    ],
  },
  {
    name: '除了…以外',
    nameEn: 'besides/apart from',
    structure: '除了 + [noun/verb phrase] + (以外), [clause]',
    level: 3,
    keywords: ['除了', '以外', 'besides', 'apart from'],
    examples: [
      '除了中文以外，我还学英文。(Chúle Zhōngwén yǐwài, wǒ hái xué Yīngwén.) — Besides Chinese, I also study English.',
      '除了他以外，大家都来了。(Chúle tā yǐwài, dàjiā dōu lái le.) — Apart from him, everyone came.',
    ],
  },
  {
    name: '连…都/也',
    nameEn: 'even',
    structure: '连 + [noun/verb phrase] + 都/也 + [verb]',
    level: 4,
    keywords: ['连', '都', '也', 'even'],
    examples: [
      '这个问题连老师都不会。(Zhège wèntí lián lǎoshī dōu bù huì.) — Even the teacher can\'t answer this question.',
      '他连早饭都没吃就走了。(Tā lián zǎofàn dōu méi chī jiù zǒu le.) — He left without even eating breakfast.',
    ],
  },
  {
    name: '不是…就是',
    nameEn: 'if not...then',
    structure: '不是 + [A], 就是 + [B]',
    level: 4,
    keywords: ['不是', '就是', 'either or'],
    examples: [
      '他不是在家就是在学校。(Tā bú shì zài jiā jiù shì zài xuéxiào.) — He\'s either at home or at school.',
      '周末我不是看书就是看电影。(Zhōumò wǒ bú shì kànshū jiù shì kàn diànyǐng.) — On weekends I either read or watch movies.',
    ],
  },
  {
    name: '只要…就',
    nameEn: 'as long as...then',
    structure: '只要 + [condition], 就 + [result]',
    level: 4,
    keywords: ['只要', '就', 'as long as'],
    examples: [
      '只要努力，就能成功。(Zhǐyào nǔlì, jiù néng chénggōng.) — As long as you work hard, you can succeed.',
      '只要你有时间，我们就去。(Zhǐyào nǐ yǒu shíjiān, wǒmen jiù qù.) — As long as you have time, we\'ll go.',
    ],
  },
  {
    name: '只有…才',
    nameEn: 'only if...then',
    structure: '只有 + [condition], 才 + [result]',
    level: 4,
    keywords: ['只有', '才', 'only if'],
    examples: [
      '只有努力学习，才能通过考试。(Zhǐyǒu nǔlì xuéxí, cái néng tōngguò kǎoshì.) — Only by studying hard can you pass the exam.',
      '只有他才知道答案。(Zhǐyǒu tā cái zhīdào dá\'àn.) — Only he knows the answer.',
    ],
  },
  {
    name: '因为…所以',
    nameEn: 'because...therefore',
    structure: '因为 + [reason], 所以 + [result]',
    level: 2,
    keywords: ['因为', '所以', 'because', 'therefore'],
    examples: [
      '因为下雨，所以我没去。(Yīnwèi xiàyǔ, suǒyǐ wǒ méi qù.) — Because it rained, I didn\'t go.',
      '因为他生病了，所以没来上课。(Yīnwèi tā shēngbìng le, suǒyǐ méi lái shàngkè.) — Because he was sick, he didn\'t come to class.',
    ],
  },
  {
    name: '如果…就',
    nameEn: 'if...then',
    structure: '如果 + [condition], 就 + [result]',
    level: 2,
    keywords: ['如果', '就', 'if', 'then'],
    examples: [
      '如果明天下雨，就不去了。(Rúguǒ míngtiān xiàyǔ, jiù bú qù le.) — If it rains tomorrow, we won\'t go.',
      '如果你有时间，就来吧。(Rúguǒ nǐ yǒu shíjiān, jiù lái ba.) — If you have time, come over.',
    ],
  },
]

export interface WordRelation {
  type: 'synonym' | 'antonym' | 'measure_word' | 'collocation'
  words: string[]
}

export const WORD_RELATIONSHIPS: Record<string, WordRelation[]> = {
  // Synonyms
  '看': [{ type: 'synonym', words: ['见', '观'] }],
  '见': [{ type: 'synonym', words: ['看'] }],
  '说': [{ type: 'synonym', words: ['讲', '谈'] }],
  '讲': [{ type: 'synonym', words: ['说', '谈'] }],
  '谈': [{ type: 'synonym', words: ['说', '讲'] }],
  '高兴': [{ type: 'synonym', words: ['快乐'] }],
  '快乐': [{ type: 'synonym', words: ['高兴'] }],
  '大': [{ type: 'synonym', words: ['巨大'], }, { type: 'antonym', words: ['小'] }],
  '巨大': [{ type: 'synonym', words: ['大'] }],
  '小': [{ type: 'synonym', words: ['微小'], }, { type: 'antonym', words: ['大'] }],
  '微小': [{ type: 'synonym', words: ['小'] }],
  '想': [{ type: 'synonym', words: ['认为'] }],
  '认为': [{ type: 'synonym', words: ['想'] }],
  '观': [{ type: 'synonym', words: ['看'] }],
  // Antonyms
  '多': [{ type: 'antonym', words: ['少'] }],
  '少': [{ type: 'antonym', words: ['多'] }],
  '好': [{ type: 'antonym', words: ['坏'] }],
  '坏': [{ type: 'antonym', words: ['好'] }],
  '热': [{ type: 'antonym', words: ['冷'] }],
  '冷': [{ type: 'antonym', words: ['热'] }],
  '快': [{ type: 'antonym', words: ['慢'] }],
  '慢': [{ type: 'antonym', words: ['快'] }],
  '来': [{ type: 'antonym', words: ['去'] }],
  '去': [{ type: 'antonym', words: ['来'] }],
  '买': [{ type: 'antonym', words: ['卖'] }],
  '卖': [{ type: 'antonym', words: ['买'] }],
  '上': [{ type: 'antonym', words: ['下'] }],
  '下': [{ type: 'antonym', words: ['上'] }],
  '前': [{ type: 'antonym', words: ['后'] }],
  '后': [{ type: 'antonym', words: ['前'] }],
  '左': [{ type: 'antonym', words: ['右'] }],
  '右': [{ type: 'antonym', words: ['左'] }],
  // Measure words
  '书': [{ type: 'measure_word', words: ['本'] }],
  '人': [{ type: 'measure_word', words: ['个', '位'] }],
  '花': [{ type: 'measure_word', words: ['朵'] }],
  '车': [{ type: 'measure_word', words: ['辆'] }],
  '衣服': [{ type: 'measure_word', words: ['件'] }],
  '纸': [{ type: 'measure_word', words: ['张'] }],
  '水果': [{ type: 'measure_word', words: ['个', '斤'] }],
  // Common collocations
  '打': [{ type: 'collocation', words: ['电话', '车'] }],
  '开': [{ type: 'collocation', words: ['车', '门'] }],
  '做': [{ type: 'collocation', words: ['饭'] }],
  '吃': [{ type: 'collocation', words: ['饭'] }],
  '喝': [{ type: 'collocation', words: ['水'] }],
  '写': [{ type: 'collocation', words: ['字'] }],
  '读': [{ type: 'collocation', words: ['书'] }],
  '学': [{ type: 'collocation', words: ['中文'] }],
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  words?: Word[]
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  userId: string
  mode?: AIMode
  contextId?: string
  contextTitle?: string
}

// Build context from relevant vocabulary (used when integrating AI LLM)
export function buildContext(words: Word[], grammarPatterns: GrammarPattern[] = [], relatedWords: string[] = []): string {
  const parts: string[] = []

  if (words.length > 0) {
    const lines = words.map((w) => {
      const pos = Array.isArray(w.pos) ? w.pos.join('/') : ''
      return `- ${w.chinese} (${w.pinyin}): ${w.english}${pos ? ` [${pos}]` : ''} (HSK ${w.hsk_level})`
    })
    parts.push(`[Reference vocabulary — use this to inform your answers, do NOT list these to the user unless asked]:\n${lines.join('\n')}`)
  }

  if (grammarPatterns.length > 0) {
    const patternLines = grammarPatterns.map((p) => {
      const exLines = p.examples.map((ex) => `    - ${ex}`).join('\n')
      return `- **${p.name}** (${p.nameEn}) [HSK ${p.level}]\n  Structure: ${p.structure}\n  Examples:\n${exLines}`
    })
    parts.push(`[Reference grammar patterns — use when relevant to the user's question]:\n${patternLines.join('\n')}`)
  }

  if (relatedWords.length > 0) {
    parts.push(`[Related words to consider mentioning naturally]: ${relatedWords.join(', ')}`)
  }

  return parts.join('\n\n')
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

// Generate a response using DeepSeek with retry logic
export interface GenerateResponseOptions {
  mode?: AIMode
  contextId?: string
  userId?: string
  isGuest?: boolean
}

export async function generateResponse(
  messages: ChatMessage[],
  onStream?: (chunk: string) => void,
  userName?: string,
  options: GenerateResponseOptions = {},
): Promise<{ content: string; words: Word[] }> {
  const { mode = 'chat', contextId, userId, isGuest = true } = options

  // Load vocabulary data for accurate answers
  const vocab = await getVocab()
  const userQuery = messages.filter((m) => m.role === 'user').pop()?.content || ''
  const vocabContext = buildVocabContext(vocab, userQuery)
  const userContext = buildUserContext(userName)
  const progressContext = userId ? await buildUserProgressContext(userId, isGuest) : ''

  // Mode-specific system prompt additions
  let modeAddition = ''
  if (mode === 'conversation' && contextId) {
    const { SCENARIO_BY_ID } = await import('@/data/aiModes')
    const scenario = SCENARIO_BY_ID[contextId]
    if (scenario) {
      const userLevel = parseInt(localStorage.getItem('hsk_level') || '0') || 0
      modeAddition = CONVERSATION_SYSTEM_PROMPT(scenario, userLevel)
    }
  } else if (mode === 'grammar' && contextId) {
    const pattern = GRAMMAR_PATTERNS.find((p) => p.name === contextId)
    if (pattern) {
      const userLevel = parseInt(localStorage.getItem('hsk_level') || '0') || 0
      modeAddition = GRAMMAR_SYSTEM_PROMPT(pattern.name, pattern.nameEn, pattern.structure, pattern.examples, userLevel)
    }
  }

  const fullSystemPrompt =
    SYSTEM_PROMPT +
    (modeAddition ? '\n\n' + modeAddition : '') +
    (vocabContext ? '\n\n' + vocabContext : '') +
    (userContext ? '\n\n' + userContext : '') +
    (progressContext ? '\n\n' + progressContext : '')

  const apiMessages = [
    { role: 'system', content: fullSystemPrompt },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }

      const response = await fetchWithTimeout(AI_BACKEND.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AI_BACKEND.authHeader(),
        },
        body: JSON.stringify({
          messages: apiMessages,
          stream: !!onStream,
          temperature: 0.5,
          max_tokens: 512,
        }),
      }, REQUEST_TIMEOUT)

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error')
        console.error(`[AI Chat] API HTTP error (attempt ${attempt + 1}):`, response.status, errText.slice(0, 200))
        // Don't retry on auth errors. The user-visible message is intentionally
        // generic so we don't confirm whether a key path is reachable.
        if (response.status === 401 || response.status === 403) {
          throw new Error('AI service is unavailable. Please try again later.')
        }
        lastError = new Error(`API returned ${response.status}`)
        continue
      }

      if (onStream && response.body) {
        // Streaming response
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                onStream(delta)
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim().startsWith('data:')) {
          const data = buffer.trim().slice(5).trim()
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                onStream(delta)
              }
            } catch {
              // Skip
            }
          }
        }

        if (!fullContent) {
          lastError = new Error('Empty response from API')
          continue
        }

        const words = extractWordsFromResponse(fullContent, vocab)
        return { content: fullContent, words }
      } else {
        // Non-streaming response
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        if (!content) {
          lastError = new Error('Empty response from API')
          continue
        }
        const words = extractWordsFromResponse(content, vocab)
        return { content, words }
      }
    } catch (error) {
      const errName = error instanceof Error ? error.name : ''
      if (errName === 'AbortError') {
        lastError = new Error('Request timed out')
      } else if (error instanceof Error && error.message.includes('API key is invalid')) {
        throw error // Don't retry auth errors
      } else {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  // All retries failed — fall back to offline response
  if (lastError) {
    console.log('[AI Chat] API failed, using offline fallback:', lastError.message)
  }
  const q = messages.filter(m => m.role === 'user').pop()?.content || ''
  const fallbackVocab = await getVocab()
  const fallbackContent = await offlineFallback(q, fallbackVocab)
  if (onStream) {
    // Emit the fallback as one chunk instead of word-by-word. The old
    // word-at-a-time stream caused layout thrashing in the chat UI and
    // contributed to the "message appears then vanishes" flash.
    onStream(fallbackContent)
  }
  return { content: fallbackContent, words: extractWordsFromResponse(fallbackContent, fallbackVocab) }
}

// Offline fallback when API is unavailable — conversational, not robotic
async function offlineFallback(query: string, words: Word[]): Promise<string> {
  await new Promise((r) => setTimeout(r, 300))

  const q = query.toLowerCase().trim()

  // Handle greetings
  if (/^(hi|hello|hey|你好|nǐ hǎo)/i.test(q)) {
    const greetings = [
      `你好！👋 Nice to see you! 今天想学点什么？(What do you want to learn today?) Fun fact: 你好 literally means "you good" — Chinese is pretty logical, right?`,
      `嘿！Hey there! 你好 (nǐ hǎo)! Ready to learn some Chinese? Tell me a word you're curious about, or I can pick something fun for you.`,
      `你好呀！Welcome back! 你知道吗 — just saying "谢谢" (xièxie, thank you) already makes you sound polite in Chinese. What are you working on?`,
    ]
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  // Try to find a specific word the user is asking about
  let targetWord: Word | null = null
  const chineseMatch = query.match(/[\u4e00-\u9fff]+/)
  if (chineseMatch) {
    targetWord = words.find(w => w.chinese === chineseMatch[0]) || null
  }
  if (!targetWord) {
    const englishMatch = query.match(/'([^']+)'/) || query.match(/"([^"]+)"/)
    if (englishMatch) {
      const term = englishMatch[1].toLowerCase()
      targetWord = words.find(w => w.english.toLowerCase().includes(term)) || null
    }
  }

  // Handle specific word lookup
  if (targetWord) {
    const pos = Array.isArray(targetWord.pos) ? targetWord.pos.join(', ') : 'N/A'
    return `**${targetWord.chinese}** (${targetWord.pinyin}) — ${targetWord.english} · HSK ${targetWord.hsk_level}\n\nPart of speech: ${pos}`
  }

  // Handle level-specific queries
  const levelMatch = q.match(/hsk\s*([1-4])/)
  if (levelMatch) {
    const level = parseInt(levelMatch[1])
    const levelWords = words.filter((w) => w.hsk_level === level)
    if (levelWords.length > 0) {
      const shuffled = [...levelWords].sort(() => Math.random() - 0.5)
      const list = shuffled.slice(0, 5).map((w) => `  - **${w.chinese}** (${w.pinyin}): ${w.english}`).join('\n')
      return `Here are some HSK ${level} words I found:\n\n${list}\n\n(${levelWords.length} total words in HSK ${level})`
    }
  }

  // Handle translation/meaning requests without a specific target
  if (q.includes('translate') || q.includes('how do you say') || q.includes('what is') || q.includes('mean')) {
    if (words.length > 0) {
      const shuffled = [...words].sort(() => Math.random() - 0.5)
      const w = shuffled[0]
      return `**${w.chinese}** (${w.pinyin}) — ${w.english} · HSK ${w.hsk_level}\n\n(Showing a random word — I'm offline right now so I can't search. Try asking about a specific word!)`
    }
  }

  // Handle practice/quiz requests
  if (q.includes('quiz') || q.includes('practice') || q.includes('test')) {
    if (words.length >= 4) {
      const shuffled = [...words].sort(() => Math.random() - 0.5)
      const correct = shuffled[0]
      const options = shuffled.slice(0, 4).sort(() => Math.random() - 0.5)
      const optionList = options.map((w, i) => `${String.fromCharCode(65 + i)}) ${w.english}`).join('\n')
      return `**Quick Quiz!** 🎯\n\nWhat does **${correct.chinese}** (${correct.pinyin}) mean?\n\n${optionList}\n\nReply with A, B, C, or D!`
    }
    return `I'd love to quiz you, but I need more vocabulary loaded first. Try browsing some words in the Vocabulary section, then come back for a quiz!`
  }

  // Handle grammar/usage questions
  if (q.includes('grammar') || q.includes('use') || q.includes('sentence') || q.includes('example')) {
    if (words.length > 0) {
      const shuffled = [...words].sort(() => Math.random() - 0.5)
      const w = shuffled[0]
      const pos = Array.isArray(w.pos) ? w.pos.join(', ') : 'unknown'
      return `**${w.chinese}** (${w.pinyin}) — ${w.english} · HSK ${w.hsk_level}\n\nPart of speech: ${pos}\n\n(Showing a random word — I'm offline so can't do deep grammar lookups right now!)`
    }
  }

  // General response with context
  if (words.length > 0) {
    const shuffled = [...words].sort(() => Math.random() - 0.5)
    const list = shuffled.slice(0, 5).map((w) => `  - **${w.chinese}** (${w.pinyin}): ${w.english}`).join('\n')
    return `Some words from the HSK vocabulary:\n\n${list}\n\n(I'm offline — for better answers try going online!)`
  }

  return `I'm offline right now so my responses are limited 😅 But I'll be back to full power once the connection is restored. In the meantime, try asking about a specific HSK word!`
}

// Generate a specialized prompt for study plan generation
export function generateStudyPlanPrompt(progress: {
  totalLearned: number
  masteryDistribution: Record<number, number>
  weakWords: string[]
  streakDays: number
}): string {
  const masteryEntries = Object.entries(progress.masteryDistribution)
    .map(([level, count]) => `  Mastery Level ${level}: ${count} words`)
    .join('\n')

  return `You are an expert HSK study plan generator. Based on the user's progress data below, create a personalized study plan.

User's Current Progress:
- Total words learned: ${progress.totalLearned}
- Mastery distribution:
${masteryEntries}
- Weak words (need review): ${progress.weakWords.length > 0 ? progress.weakWords.join(', ') : 'None identified'}
- Current streak: ${progress.streakDays} days

Please create a study plan that:
1. **Analyzes current progress** — Summarize the user's strengths and areas needing improvement
2. **Identifies weak areas** — Focus on the weak words listed and suggest why they might be difficult
3. **Suggests specific words to review** — List 5-10 priority words from the weak list with brief reasons
4. **Recommends study modes** — Suggest which study modes (flashcards, quiz, writing practice, listening) would be most effective and why
5. **Creates a daily schedule** — Provide a structured daily plan (e.g., morning review, afternoon new words, evening practice) with time estimates

Format the plan with clear headings and bullet points. Be encouraging but realistic. Adjust difficulty based on the user's current level.`
}

// Session storage helpers
const SESSIONS_KEY = 'hsk-chat-sessions-v2'

// Sentence validation for Sentence Making mode
export interface SentenceValidation {
  isCorrect: boolean
  score: number // 0-5
  feedback: string
  corrections: string[]
  betterSentence: string
  grammarTips: string[]
}

export async function validateSentenceWithAI(
  word: Word,
  userSentence: string
): Promise<SentenceValidation> {
  const prompt = `You are a Chinese language teacher evaluating a student's sentence. The target word is "${word.chinese}" (${word.pinyin}, meaning: "${word.english}", HSK level ${word.hsk_level}, POS: ${Array.isArray(word.pos) ? word.pos.join('/') : word.pos}).

The student wrote: "${userSentence}"

Evaluate this sentence. Respond with ONLY a JSON object, no other text:
{"isCorrect":true/false,"score":0-5,"feedback":"Brief encouraging feedback","corrections":["errors if any"],"betterSentence":"improved version or same if good","grammarTips":["1-2 tips"]}

Scoring: 5=perfect, 4=correct but could be more natural, 3=minor errors, 2=grammatical errors, 1=major errors, 0=missing target word or completely wrong.

If the sentence doesn't include "${word.chinese}", set isCorrect=false and score=0.`

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }

      const response = await fetchWithTimeout(AI_BACKEND.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AI_BACKEND.authHeader(),
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: 'You are a Chinese language teacher. Respond with valid JSON only, no markdown.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 512,
          response_format: { type: 'json_object' },
        }),
      }, REQUEST_TIMEOUT)

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('API key is invalid')
        }
        lastError = new Error(`API returned ${response.status}`)
        continue
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

      // Parse JSON from response
      const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const result = JSON.parse(jsonStr)

      return {
        isCorrect: result.isCorrect ?? false,
        score: Math.min(5, Math.max(0, result.score ?? 0)),
        feedback: result.feedback || '',
        corrections: result.corrections || [],
        betterSentence: result.betterSentence || '',
        grammarTips: result.grammarTips || [],
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Sentence validation error (attempt ${attempt + 1}):`, lastError.message)
    }
  }

  // Fallback: basic validation
  console.error('Sentence validation failed, using fallback:', lastError?.message)
  const hasWord = userSentence.includes(word.chinese)
  const minLength = userSentence.length >= 5
  return {
    isCorrect: hasWord && minLength,
    score: hasWord && minLength ? 4 : 0,
    feedback: hasWord && minLength ? 'Good sentence! Keep practicing.' : 'Make sure your sentence includes the target word and is at least 5 characters.',
    corrections: !hasWord ? [`Missing target word "${word.chinese}"`] : !minLength ? ['Sentence is too short'] : [],
    betterSentence: hasWord ? userSentence : '',
    grammarTips: [],
  }
}

export function loadSessions(): ChatSession[] {
  try {
    const data = localStorage.getItem(SESSIONS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveSessions(sessions: ChatSession[]) {
  try {
    const slim = sessions.map((s) => ({
      ...s,
      messages: s.messages.map((m) => ({ ...m, words: undefined })),
    }))
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(slim))
  } catch {
    try {
      const slim = sessions.slice(0, 10).map((s) => ({
        ...s,
        messages: s.messages.map((m) => ({ ...m, words: undefined })),
      }))
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(slim))
    } catch {
    }
  }
}

export function loadUserSessions(userId: string): ChatSession[] {
  const all = loadSessions()
  return all.filter((s) => (s.userId || '') === userId)
}

export function clearUserChat(userId: string): number {
  const all = loadSessions()
  const remaining = all.filter((s) => (s.userId || '') !== userId)
  const removed = all.length - remaining.length
  saveSessions(remaining)
  return removed
}

export function clearAllChat(): number {
  const all = loadSessions()
  const count = all.reduce((sum, s) => sum + s.messages.length, 0)
  localStorage.removeItem(SESSIONS_KEY)
  return count
}

export function getChatStorageSize(): { sessions: number; messages: number; sizeBytes: number } {
  const all = loadSessions()
  const raw = localStorage.getItem(SESSIONS_KEY) || ''
  return {
    sessions: all.length,
    messages: all.reduce((sum, s) => sum + s.messages.length, 0),
    sizeBytes: raw.length * 2,
  }
}

// ═══════════════════════════════════════════════════════════════
// AI-powered features for learning modes
// ═══════════════════════════════════════════════════════════════

async function callAI(prompt: string, systemPrompt: string): Promise<string> {
  const response = await fetchWithTimeout(AI_BACKEND.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...AI_BACKEND.authHeader(),
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    }),
  }, REQUEST_TIMEOUT)

  if (!response.ok) {
    throw new Error(`AI API returned ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Sequential Quiz: Generate AI-powered quiz questions ──
export interface AIQuizQuestion {
  type: 'mcq' | 'fill-blank'
  word: string
  pinyin: string
  english: string
  question: string
  options?: string[]
  correctAnswer: string
  explanation: string
}

export async function generateAIQuizQuestions(
  level: string,
  count: number,
  words: Word[]
): Promise<AIQuizQuestion[]> {
  // Select words at the right level
  const levelWords = words.filter((w) => `HSK ${w.hsk_level}` === level || w.hsk_level === parseInt(level.replace('HSK ', '')))
    .sort(() => Math.random() - 0.5)
    .slice(0, count)

  if (levelWords.length === 0) throw new Error('No words available for this level')

  const wordList = levelWords.map((w) => `${w.chinese} (${w.pinyin}) = ${w.english} [HSK ${w.hsk_level}]`).join('\n')

  const prompt = `Create ${Math.min(count, levelWords.length)} quiz questions for HSK Chinese vocabulary learning. Use these words as targets:

${wordList}

For each word, create ONE question. Alternate between:
1. "mcq" - Multiple choice: show the Chinese word, ask for the English meaning with 4 options
2. "fill-blank" - Show English meaning and pinyin, ask for Chinese character

Return ONLY valid JSON array, no markdown, no explanation:
[
  {
    "type": "mcq",
    "word": "你好",
    "pinyin": "nǐ hǎo",
    "english": "hello",
    "question": "What does 你好 mean?",
    "options": ["hello", "goodbye", "thank you", "sorry"],
    "correctAnswer": "hello",
    "explanation": "你好 (nǐ hǎo) is the standard greeting"
  },
  ...
]

Make wrong options plausible but clearly wrong. Ensure the correctAnswer matches the word exactly.`

  const content = await callAI(prompt, 'You are an HSK Chinese teacher creating quiz questions. Respond with valid JSON array only.')

  // Parse JSON from response
  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    const questions = JSON.parse(jsonStr) as AIQuizQuestion[]
    return questions.slice(0, count)
  } catch {
    // If AI fails, extract questions manually or return fallback
    console.error('Failed to parse AI quiz questions:', jsonStr)
    throw new Error('Failed to generate AI quiz questions')
  }
}

// ── Translation: AI-powered translation evaluation ──
export interface AITranslationEval {
  isCorrect: boolean
  score: number
  feedback: string
  correctAnswer: string
  suggestions: string[]
}

export async function evaluateTranslationWithAI(
  word: Word,
  direction: 'zh-en' | 'en-zh',
  userAnswer: string
): Promise<AITranslationEval> {
  const source = direction === 'zh-en' ? word.chinese : word.english
  const target = direction === 'zh-en' ? word.english : word.chinese

  const prompt = `Evaluate this Chinese-English translation:

Word information:
- Chinese: ${word.chinese}
- Pinyin: ${word.pinyin}
- English: ${word.english}
- HSK Level: ${word.hsk_level}

Direction: ${direction === 'zh-en' ? 'Chinese → English' : 'English → Chinese'}
Source text: "${source}"
Student's answer: "${userAnswer}"
Correct answer: "${target}"

Evaluate the student's answer. Consider:
- For "close" answers: minor spelling, similar meaning, or near-correct
- Score: 5=perfect, 4=close/similar, 3=partial, 2=wrong but related, 1=completely wrong, 0=blank

Return ONLY valid JSON:
{"isCorrect":true/false,"score":0-5,"feedback":"brief helpful feedback","correctAnswer":"${target}","suggestions":["tip1","tip2"]}`

  const content = await callAI(prompt, 'You are a Chinese language teacher evaluating translations. Respond with valid JSON only.')

  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(jsonStr) as AITranslationEval
  } catch {
    // Fallback evaluation
    const userLower = userAnswer.trim().toLowerCase()
    const correctLower = target.toLowerCase()
    const isCorrect = userLower === correctLower
    const isClose = !isCorrect && (userLower.includes(correctLower) || correctLower.includes(userLower))
    return {
      isCorrect,
      score: isCorrect ? 5 : isClose ? 4 : Math.min(3, userLower.length > 0 ? 2 : 0),
      feedback: isCorrect ? 'Perfect translation!' : isClose ? 'Very close! Almost correct.' : 'Not quite. Review the answer.',
      correctAnswer: target,
      suggestions: isCorrect ? [] : [`The correct answer is "${target}"`],
    }
  }
}

// ── Translation: Generate AI translation sentences ──
export async function generateTranslationSentence(
  level: string,
  words: Word[]
): Promise<{ word: Word; sentence: string }> {
  const levelNum = parseInt(level.replace('HSK ', ''))
  const levelWords = words.filter((w) => w.hsk_level === levelNum).sort(() => Math.random() - 0.5)
  if (levelWords.length === 0) throw new Error('No words for this level')

  const sample = levelWords.slice(0, 10).map((w) => `${w.chinese} (${w.pinyin}) = ${w.english}`).join('\n')

  const prompt = `Pick ONE random word from this vocabulary list and create a natural Chinese sentence (8-20 characters) using it. The sentence should be appropriate for HSK ${levelNum} level.

Vocabulary:
${sample}

Return ONLY JSON:
{"chinese":"选中的词","pinyin":"xuǎn zhòng de cí","english":"selected word","sentence":"using the word naturally in context"}`

  const content = await callAI(prompt, 'You create natural Chinese sentences for language learners. Respond with valid JSON only.')

  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    const result = JSON.parse(jsonStr)
    const matchedWord = words.find((w) => w.chinese === result.chinese)
    return {
      word: matchedWord || levelWords[0],
      sentence: result.sentence || '',
    }
  } catch {
    const w = levelWords[Math.floor(Math.random() * levelWords.length)]
    return { word: w, sentence: '' }
  }
}

// ── Sentence Puzzle: AI-generated sentences ──
export async function generatePuzzleWithAI(
  words: Word[],
  count: number
): Promise<{ sentences: { chinese: string; pinyin: string; english: string; targetWord: string }[] }> {
  // Pick random words
  const selected = [...words].sort(() => Math.random() - 0.5).slice(0, count)
  const wordList = selected.map((w) => `${w.chinese} (${w.pinyin}) = ${w.english} [HSK ${w.hsk_level}]`).join('\n')

  const prompt = `Create ${count} natural Chinese sentences (6-15 characters each) for a sentence puzzle game. Each sentence must use one of these target words:

${wordList}

For each target word, create ONE sentence. Return ONLY valid JSON array:
[
  {
    "chinese": "今天天气很好",
    "pinyin": "jīntiān tiānqì hěn hǎo",
    "english": "Today's weather is very good",
    "targetWord": "天气"
  },
  ...
]

Sentences should:
- Be natural and commonly used
- Appropriate for HSK 1-4 level
- 6-15 characters long`

  const content = await callAI(prompt, 'You create natural Chinese sentences for language learners. Respond with valid JSON array only.')

  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    const result = JSON.parse(jsonStr)
    return { sentences: result.slice(0, count) }
  } catch {
    // Fallback: use example sentences from words
    const fallback = selected
      .filter((w) => w.example_sentences && w.example_sentences.length > 0)
      .map((w) => ({
        chinese: w.example_sentences![0],
        pinyin: w.pinyin,
        english: w.english,
        targetWord: w.chinese,
      }))
    return { sentences: fallback.slice(0, count) }
  }
}
