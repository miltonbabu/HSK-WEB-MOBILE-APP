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

/**
 * HSK 4 listening scenario bank.
 * Each entry is a self-contained HSK 4 sentence/dialogue the user can hear,
 * with an English statement (Part 1) or three image options (Part 2).
 * Drawing from a curated bank guarantees the exam always has well-formed
 * listening material even when AI is unavailable.
 */
interface ListeningScenario {
  audio: string            // Chinese sentence to speak
  imageScene: string       // English description for Pollinations.ai
}

interface ListeningTFItem extends ListeningScenario {
  statement: string        // English statement shown to the user
  correct: 'True' | 'False'
}

interface ListeningDialogueItem extends ListeningScenario {
  dialogue: string         // Two-line 男/女 dialogue
  options: { scene: string; correct: boolean }[]  // 3 picture choices, exactly one correct
}

/** Part 1 bank — single-sentence scenarios with a T/F statement. */
const LISTENING_TF_BANK: ListeningTFItem[] = [
  { audio: '我每天早上七点起床。', imageScene: 'a person waking up early in a bedroom at sunrise', statement: 'The speaker wakes up at 7 a.m. every day.', correct: 'True' },
  { audio: '我每天坐地铁去上班。', imageScene: 'a commuter riding a subway train in the morning', statement: 'The speaker drives a car to work.', correct: 'False' },
  { audio: '我喜欢在周末去爬山。', imageScene: 'a group of people hiking up a mountain on a sunny day', statement: 'The speaker likes to climb mountains on weekends.', correct: 'True' },
  { audio: '我妈妈在医院工作。', imageScene: 'a doctor working in a hospital corridor', statement: 'The speaker\'s mother works at a hospital.', correct: 'True' },
  { audio: '我昨天看了两个小时的电影。', imageScene: 'people watching a movie in a cinema', statement: 'The speaker watched a movie for two hours yesterday.', correct: 'True' },
  { audio: '我弟弟比我小三岁。', imageScene: 'two siblings posing for a family photo', statement: 'The speaker\'s younger brother is three years older than them.', correct: 'False' },
  { audio: '北京冬天很冷，但是很美。', imageScene: 'a snowy Beijing cityscape in winter with traditional buildings', statement: 'Beijing is hot in winter.', correct: 'False' },
  { audio: '我打算明年去中国留学。', imageScene: 'a student with luggage at an airport ready to study abroad', statement: 'The speaker plans to study in China next year.', correct: 'True' },
  { audio: '我朋友送了我一本中文书。', imageScene: 'a person happily holding a Chinese book as a gift', statement: 'The speaker received a Chinese book from a friend.', correct: 'True' },
  { audio: '我今天早上吃了一个苹果。', imageScene: 'a person eating an apple for breakfast at a kitchen table', statement: 'The speaker ate rice for breakfast.', correct: 'False' },
  { audio: '我爸爸每天晚上都会喝茶。', imageScene: 'an older man drinking tea at home in the evening', statement: 'The speaker\'s father drinks tea every night.', correct: 'True' },
  { audio: '下个星期我们要考试了。', imageScene: 'students studying at desks with books open before an exam', statement: 'The exam is next month.', correct: 'False' },
  { audio: '她会说中文和英语。', imageScene: 'a young woman speaking confidently in two languages', statement: 'She can speak Chinese and English.', correct: 'True' },
  { audio: '我从去年开始学习钢琴。', imageScene: 'a person playing the piano in a music room', statement: 'The speaker started learning piano last year.', correct: 'True' },
  { audio: '这个菜有点儿咸。', imageScene: 'a person tasting food at a restaurant table', statement: 'The food is a little salty.', correct: 'True' },
  { audio: '请把空调关一下。', imageScene: 'a person pressing the off button on a wall air conditioner', statement: 'The speaker wants to turn on the air conditioner.', correct: 'False' },
  { audio: '我下个月要搬家。', imageScene: 'moving boxes stacked in a new apartment', statement: 'The speaker is moving next month.', correct: 'True' },
  { audio: '这本书我已经读了三遍。', imageScene: 'a stack of well-read books on a wooden desk', statement: 'The speaker has read this book three times.', correct: 'True' },
  { audio: '我们坐飞机去上海。', imageScene: 'an airplane flying over Shanghai skyline at sunset', statement: 'The speaker is going to Shanghai by train.', correct: 'False' },
  { audio: '我觉得他是对的。', imageScene: 'a person nodding in agreement during a conversation', statement: 'The speaker agrees with him.', correct: 'True' },
  { audio: '我已经吃过午饭了。', imageScene: 'an empty lunch plate on a dining table', statement: 'The speaker has already had lunch.', correct: 'True' },
  { audio: '外面正在下雨。', imageScene: 'rain falling on a city street with people holding umbrellas', statement: 'It is snowing outside.', correct: 'False' },
  { audio: '她想当一名医生。', imageScene: 'a young woman in a white medical coat smiling', statement: 'She wants to be a doctor.', correct: 'True' },
  { audio: '我忘了带钥匙。', imageScene: 'a person standing outside a locked door looking for keys', statement: 'The speaker forgot their keys.', correct: 'True' },
  { audio: '请帮我拿一下那个包。', imageScene: 'a person reaching across a counter to pick up a bag', statement: 'The speaker is asking for help carrying a bag.', correct: 'True' },
]

/** Part 2 bank — 2-line dialogues with 3 picture options (one correct). */
const LISTENING_DIALOGUE_BANK: ListeningDialogueItem[] = [
  {
    audio: '男：请问，附近有地铁站吗？ 女：有的，往前走两百米就到了。',
    imageScene: 'a person asking a stranger for directions on a city street',
    dialogue: '男：请问，附近有地铁站吗？\n女：有的，往前走两百米就到了。',
    options: [
      { scene: 'a person asking for directions to the subway', correct: true },
      { scene: 'people ordering food at a restaurant counter', correct: false },
      { scene: 'a customer paying a bill at a supermarket', correct: false },
    ],
  },
  {
    audio: '男：这个蛋糕多少钱？ 女：三十八块。',
    imageScene: 'a customer asking the price of a cake in a bakery',
    dialogue: '男：这个蛋糕多少钱？\n女：三十八块。',
    options: [
      { scene: 'a customer asking the price of a cake in a bakery', correct: true },
      { scene: 'a tourist buying a train ticket at a station', correct: false },
      { scene: 'a person borrowing a book from a library', correct: false },
    ],
  },
  {
    audio: '男：你明天有空吗？我们一起去看电影吧。 女：好啊，几点？',
    imageScene: 'two friends planning to watch a movie together',
    dialogue: '男：你明天有空吗？我们一起去看电影吧。\n女：好啊，几点？',
    options: [
      { scene: 'two friends planning to watch a movie together', correct: true },
      { scene: 'a doctor explaining a medical report to a patient', correct: false },
      { scene: 'a teacher correcting homework in a classroom', correct: false },
    ],
  },
  {
    audio: '男：这道菜太辣了。 女：要不要换一份不辣的？',
    imageScene: 'a customer at a restaurant complaining that a dish is too spicy',
    dialogue: '男：这道菜太辣了。\n女：要不要换一份不辣的？',
    options: [
      { scene: 'a customer at a restaurant complaining that a dish is too spicy', correct: true },
      { scene: 'a person asking for a taxi on a busy street', correct: false },
      { scene: 'two colleagues discussing a work report', correct: false },
    ],
  },
  {
    audio: '男：我的手机找不到了。 女：你看看是不是在包里。',
    imageScene: 'a person looking for a lost phone in a handbag',
    dialogue: '男：我的手机找不到了。\n女：你看看是不是在包里。',
    options: [
      { scene: 'a person looking for a lost phone in a handbag', correct: true },
      { scene: 'a student raising hand to ask a question in class', correct: false },
      { scene: 'a man running to catch a bus at a bus stop', correct: false },
    ],
  },
  {
    audio: '男：请问，去机场怎么走？ 女：你可以坐机场大巴。',
    imageScene: 'a traveler asking how to get to the airport',
    dialogue: '男：请问，去机场怎么走？\n女：你可以坐机场大巴。',
    options: [
      { scene: 'a traveler asking how to get to the airport', correct: true },
      { scene: 'a chef cooking in a busy restaurant kitchen', correct: false },
      { scene: 'a person watering plants in a small garden', correct: false },
    ],
  },
  {
    audio: '男：我可以试试那件红色的吗？ 女：当然可以，我去给你拿。',
    imageScene: 'a customer trying on a red shirt in a clothing store',
    dialogue: '男：我可以试试那件红色的吗？\n女：当然可以，我去给你拿。',
    options: [
      { scene: 'a customer trying on a red shirt in a clothing store', correct: true },
      { scene: 'a passenger boarding a high-speed train', correct: false },
      { scene: 'a worker fixing a broken bicycle in a shop', correct: false },
    ],
  },
  {
    audio: '男：你好，我想预约一下明天下午三点。 女：好的，请问您贵姓？',
    imageScene: 'a person making a phone appointment at a clinic reception',
    dialogue: '男：你好，我想预约一下明天下午三点。\n女：好的，请问您贵姓？',
    options: [
      { scene: 'a person making a phone appointment at a clinic reception', correct: true },
      { scene: 'a customer ordering coffee at a café counter', correct: false },
      { scene: 'a student reading a book in a quiet library', correct: false },
    ],
  },
  {
    audio: '男：今天天气真好，我们去公园散步吧。 女：好主意，我带上相机。',
    imageScene: 'two people deciding to take a walk in the park on a sunny day',
    dialogue: '男：今天天气真好，我们去公园散步吧。\n女：好主意，我带上相机。',
    options: [
      { scene: 'two people deciding to take a walk in the park on a sunny day', correct: true },
      { scene: 'a family eating dinner together at a restaurant', correct: false },
      { scene: 'a delivery man handing a package to a customer', correct: false },
    ],
  },
  {
    audio: '男：你看起来很累，要休息一下吗？ 女：谢谢，我喝杯咖啡就好了。',
    imageScene: 'a colleague offering coffee to a tired coworker at the office',
    dialogue: '男：你看起来很累，要休息一下吗？\n女：谢谢，我喝杯咖啡就好了。',
    options: [
      { scene: 'a colleague offering coffee to a tired coworker at the office', correct: true },
      { scene: 'a doctor checking a patient\'s blood pressure', correct: false },
      { scene: 'a man washing his car in the driveway', correct: false },
    ],
  },
  {
    audio: '男：请问最近的银行在哪儿？ 女：就在前面路口左转。',
    imageScene: 'a person asking a passerby for directions to the bank',
    dialogue: '男：请问最近的银行在哪儿？\n女：就在前面路口左转。',
    options: [
      { scene: 'a person asking a passerby for directions to the bank', correct: true },
      { scene: 'two friends meeting at a train station platform', correct: false },
      { scene: 'a child reading a storybook in bed', correct: false },
    ],
  },
  {
    audio: '男：这个工作什么时候能完成？ 女：大概需要一周的时间。',
    imageScene: 'a manager asking an employee about a project deadline',
    dialogue: '男：这个工作什么时候能完成？\n女：大概需要一周的时间。',
    options: [
      { scene: 'a manager asking an employee about a project deadline', correct: true },
      { scene: 'a tourist buying souvenirs at a market stall', correct: false },
      { scene: 'a swimmer practicing laps in a public pool', correct: false },
    ],
  },
  {
    audio: '男：你的护照办好了吗？ 女：办好了，下个月就可以出发了。',
    imageScene: 'two people discussing an upcoming international trip with passports',
    dialogue: '男：你的护照办好了吗？\n女：办好了，下个月就可以出发了。',
    options: [
      { scene: 'two people discussing an upcoming international trip with passports', correct: true },
      { scene: 'a person buying groceries at a vegetable market', correct: false },
      { scene: 'a waiter serving dishes at a busy restaurant', correct: false },
    ],
  },
  {
    audio: '男：请问洗手间在哪儿？ 女：一楼左转就是。',
    imageScene: 'a customer asking where the restroom is in a building lobby',
    dialogue: '男：请问洗手间在哪儿？\n女：一楼左转就是。',
    options: [
      { scene: 'a customer asking where the restroom is in a building lobby', correct: true },
      { scene: 'a person feeding ducks at a lakeside park', correct: false },
      { scene: 'a driver filling gas at a gas station', correct: false },
    ],
  },
  {
    audio: '男：我想把这件礼物送给我妈妈。 女：她一定会很喜欢的。',
    imageScene: 'a person choosing a gift for their mother at a shop',
    dialogue: '男：我想把这件礼物送给我妈妈。\n女：她一定会很喜欢的。',
    options: [
      { scene: 'a person choosing a gift for their mother at a shop', correct: true },
      { scene: 'a student taking an online Chinese class at home', correct: false },
      { scene: 'a man repairing a leaking kitchen faucet', correct: false },
    ],
  },
  {
    audio: '男：我已经学过两年中文了。 女：说得真好！你是在哪儿学的？',
    imageScene: 'a Chinese learner proudly chatting about language progress with a friend',
    dialogue: '男：我已经学过两年中文了。\n女：说得真好！你是在哪儿学的？',
    options: [
      { scene: 'a Chinese learner proudly chatting about language progress with a friend', correct: true },
      { scene: 'a family watching television together on a sofa', correct: false },
      { scene: 'a person carrying a heavy suitcase up some stairs', correct: false },
    ],
  },
  {
    audio: '男：天气这么冷，你怎么穿这么少？ 女：我刚从外面回来，还热着呢。',
    imageScene: 'a person coming indoors still warm from cold weather outside',
    dialogue: '男：天气这么冷，你怎么穿这么少？\n女：我刚从外面回来，还热着呢。',
    options: [
      { scene: 'a person coming indoors still warm from cold weather outside', correct: true },
      { scene: 'a teacher explaining a math problem on a blackboard', correct: false },
      { scene: 'two tourists taking photos at a famous landmark', correct: false },
    ],
  },
  {
    audio: '男：你的手机响了。 女：哦，谢谢，我没听到。',
    imageScene: 'a colleague pointing out that a phone is ringing in a meeting room',
    dialogue: '男：你的手机响了。\n女：哦，谢谢，我没听到。',
    options: [
      { scene: 'a colleague pointing out that a phone is ringing in a meeting room', correct: true },
      { scene: 'a person taking a nap on a couch at home', correct: false },
      { scene: 'a chef decorating a cake in a bakery kitchen', correct: false },
    ],
  },
  {
    audio: '男：你每天几点下班？ 女：六点左右。',
    imageScene: 'two coworkers chatting about their daily work schedule in the office',
    dialogue: '男：你每天几点下班？\n女：六点左右。',
    options: [
      { scene: 'two coworkers chatting about their daily work schedule in the office', correct: true },
      { scene: 'a person kayaking on a calm lake at sunset', correct: false },
      { scene: 'a customer trying on shoes in a shoe store', correct: false },
    ],
  },
  {
    audio: '男：这件衣服太大了，能换一件吗？ 女：好的，我帮您找一件小号的。',
    imageScene: 'a customer in a clothing store asking to exchange a jacket for a smaller size',
    dialogue: '男：这件衣服太大了，能换一件吗？\n女：好的，我帮您找一件小号的。',
    options: [
      { scene: 'a customer in a clothing store asking to exchange a jacket for a smaller size', correct: true },
      { scene: 'a man waiting at a bus stop in heavy rain', correct: false },
      { scene: 'a doctor giving a vaccine injection to a child', correct: false },
    ],
  },
]

function genListeningTF(words: Word[], count: number): ExamQuestion[] {
  const items = pick(LISTENING_TF_BANK, count)
  return items.map((item, i) => {
    const fallbackWord = words[i] || words[0]
    return {
      id: uid('ltf', i),
      section: 'listening' as const,
      type: 'listening-tf' as const,
      prompt: 'Listen to the audio. Decide if the statement is true or false.',
      audioText: item.audio,
      statement: item.statement,
      imageUrl: buildPictureUrl(item.imageScene),
      options: ['True', 'False'],
      correctAnswer: item.correct,
      word: fallbackWord,
    }
  })
}

function genListeningDialogueMCQ(words: Word[], count: number): ExamQuestion[] {
  const items = pick(LISTENING_DIALOGUE_BANK, count)
  return items.map((item, i) => {
    const fallbackWord = words[i] || words[0]
    // Shuffle the picture options so the correct one is not always in slot A.
    const shuffledOpts = shuffle(item.options)
    return {
      id: uid('ldlg', i),
      section: 'listening' as const,
      type: 'listening-mcq' as const,
      prompt: 'Listen to the dialogue. Which picture matches the situation?',
      audioText: item.audio,
      passage: item.dialogue,
      imageOptions: shuffledOpts.map((o) => ({
        url: buildPictureUrl(o.scene),
        correct: o.correct,
      })),
      options: shuffledOpts.map((_, idx) => String.fromCharCode(65 + idx)),
      correctAnswer: String.fromCharCode(
        65 + shuffledOpts.findIndex((o) => o.correct),
      ),
      word: fallbackWord,
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

// ── Image prefetch ────────────────────────────────────────────────

/**
 * Eagerly fetch every Pollinations.ai image URL on the exam and convert each
 * to a same-origin blob URL. This guarantees images render instantly the
 * moment a question is shown (no network round-trip, no 5–15 s wait).
 *
 * Failures are silently swallowed: a missing image falls back to the
 * gradient placeholder rendered in ExamQuestionView.
 */
export async function prefetchExamImages(
  sections: ExamSection[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Collect every unique image URL across the exam.
  const urlMap = new Map<string, string>() // original → blob
  for (const section of sections) {
    for (const q of section.questions) {
      if (q.imageUrl) urlMap.set(q.imageUrl, q.imageUrl)
      if (q.imageOptions) {
        for (const o of q.imageOptions) urlMap.set(o.url, o.url)
      }
    }
  }
  const urls = Array.from(urlMap.keys())
  if (urls.length === 0) return

  let done = 0
  const total = urls.length
  onProgress?.(0, total)

  await Promise.all(
    urls.map(async (url) => {
      try {
        const resp = await fetch(url, { signal, mode: 'cors' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const blob = await resp.blob()
        const blobUrl = URL.createObjectURL(blob)
        // Patch the original URL on every question that referenced it.
        for (const section of sections) {
          for (const q of section.questions) {
            if (q.imageUrl === url) q.imageUrl = blobUrl
            if (q.imageOptions) {
              for (const o of q.imageOptions) {
                if (o.url === url) o.url = blobUrl
              }
            }
          }
        }
      } catch (err) {
        // Silent — original URL still works, just slower
        if ((err as any)?.name !== 'AbortError') {
          console.warn('[Exam] image prefetch failed:', url, err)
        }
      } finally {
        done++
        onProgress?.(done, total)
      }
    }),
  )
}

export interface GenerateProgress {
  step: 'questions' | 'images'
  done: number
  total: number
  message: string
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

  // Part 3: Passage MCQ (AI only — skip silently if AI fails so we never
  // serve a broken algorithmic fallback)
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
    }
    // If AI fails, we just skip Part 3 — the curated Parts 1 & 2 are enough
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
  onProgress?: (p: GenerateProgress) => void,
): Promise<ExamSection[]> {
  onProgress?.({ step: 'questions', done: 0, total: 0, message: 'Loading vocabulary…' })

  const plan = PLANS[length]
  const allWords = await wordService.getByLevel(level)
  if (allWords.length === 0) throw new Error(`No words found for HSK level ${level}`)

  // Shuffle once so sections pull from different words.
  const shuffled = shuffle(allWords)

  onProgress?.({ step: 'questions', done: 1, total: 3, message: 'Generating listening section…' })
  const listeningQs = await buildListeningSection(plan, shuffled, signal)
  onProgress?.({ step: 'questions', done: 2, total: 3, message: 'Generating reading section…' })
  const readingQs = await buildReadingSection(plan, shuffled, signal)
  onProgress?.({ step: 'questions', done: 3, total: 3, message: 'Generating writing section…' })
  const writingQs = await buildWritingSection(plan, shuffled, signal)

  const durations = DURATIONS[length]

  const sections: ExamSection[] = [
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

  // Eagerly fetch every Pollinations.ai image so the exam proceeds without
  // any per-question network round-trips. Audio is synthesized on-the-fly by
  // the browser's built-in TTS (zero prep time).
  onProgress?.({ step: 'images', done: 0, total: 1, message: 'Preparing images…' })
  await prefetchExamImages(
    sections,
    (done, total) => {
      onProgress?.({
        step: 'images',
        done,
        total,
        message: `Loading images… (${done}/${total})`,
      })
    },
    signal,
  )

  return sections
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
