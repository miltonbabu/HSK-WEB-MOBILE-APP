import { GraduationCap, MessageCircle, Sparkles, LucideIcon, ChefHat, MapPin, ShoppingBag, Hotel, Stethoscope, Coffee, Plane, Briefcase, Heart, Phone } from 'lucide-react'

export type AIMode = 'chat' | 'conversation' | 'grammar'

export interface AIModeConfig {
  id: AIMode
  label: string
  shortLabel: string
  icon: LucideIcon
  description: string
  emptyTitle: string
  emptySubtitle: string
}

export const AI_MODES: AIModeConfig[] = [
  {
    id: 'chat',
    label: 'Free Chat',
    shortLabel: 'Chat',
    icon: Sparkles,
    description: 'General Chinese tutor — ask anything',
    emptyTitle: 'HSK Study Assistant',
    emptySubtitle: 'Ask about Chinese vocabulary, grammar, or get practice quizzes.',
  },
  {
    id: 'conversation',
    label: 'Conversation',
    shortLabel: 'Talk',
    icon: MessageCircle,
    description: 'Practice real scenarios with an AI partner',
    emptyTitle: 'Pick a scenario',
    emptySubtitle: 'Choose a situation to practice. The AI will stay in character.',
  },
  {
    id: 'grammar',
    label: 'Grammar',
    shortLabel: 'Grammar',
    icon: GraduationCap,
    description: 'Focus on a specific grammar pattern',
    emptyTitle: 'Pick a grammar pattern',
    emptySubtitle: 'Choose a pattern to study. The AI will teach with examples.',
  },
]

export const AI_MODE_BY_ID: Record<AIMode, AIModeConfig> = AI_MODES.reduce(
  (acc, m) => ({ ...acc, [m.id]: m }),
  {} as Record<AIMode, AIModeConfig>
)

// ── Conversation scenarios ─────────────────────────────────────────────────

export interface ConversationScenario {
  id: string
  title: string
  emoji: string
  icon: LucideIcon
  setting: string
  aiRole: string
  userGoal: string
  starter: string // opening line from AI
  hskLevel: 1 | 2 | 3 | 4
}

export const CONVERSATION_SCENARIOS: ConversationScenario[] = [
  {
    id: 'restaurant',
    title: 'Ordering at a restaurant',
    emoji: '🥢',
    icon: ChefHat,
    setting: 'A casual Chinese restaurant in Beijing',
    aiRole: 'a friendly waiter',
    userGoal: 'Order food, ask about dishes, and ask for the bill',
    starter: '欢迎光临！请坐请坐。请问您想吃点什么？(Welcome! Please sit. What would you like to eat?)',
    hskLevel: 1,
  },
  {
    id: 'directions',
    title: 'Asking for directions',
    emoji: '🗺️',
    icon: MapPin,
    setting: 'A busy street in Shanghai',
    aiRole: 'a helpful local passerby',
    userGoal: 'Find a specific place (bank, hotel, subway station)',
    starter: '你好！请问需要帮忙吗？(Hi! Do you need help?)',
    hskLevel: 1,
  },
  {
    id: 'shopping',
    title: 'Shopping at a market',
    emoji: '🛍️',
    icon: ShoppingBag,
    setting: 'A clothing market',
    aiRole: 'a market vendor',
    userGoal: 'Buy clothes, ask for sizes, bargain a little',
    starter: '你好啊！想看点什么？(Hello! What are you looking for?)',
    hskLevel: 2,
  },
  {
    id: 'hotel',
    title: 'Checking into a hotel',
    emoji: '🏨',
    icon: Hotel,
    setting: 'A hotel reception desk',
    aiRole: 'a hotel receptionist',
    userGoal: 'Check in, ask about amenities, ask about checkout time',
    starter: '您好，欢迎光临。请问您预订了吗？(Welcome. Do you have a reservation?)',
    hskLevel: 2,
  },
  {
    id: 'doctor',
    title: 'At the doctor',
    emoji: '⚕️',
    icon: Stethoscope,
    setting: 'A doctor\'s office',
    aiRole: 'a doctor',
    userGoal: 'Describe symptoms, understand the diagnosis',
    starter: '你好，请坐。你哪里不舒服？(Hi, please sit. What\'s wrong?)',
    hskLevel: 3,
  },
  {
    id: 'cafe',
    title: 'At a coffee shop',
    emoji: '☕',
    icon: Coffee,
    setting: 'A modern coffee shop',
    aiRole: 'a barista',
    userGoal: 'Order a drink, customize it, pay',
    starter: '欢迎光临！请问喝点什么？(Welcome! What would you like to drink?)',
    hskLevel: 1,
  },
  {
    id: 'airport',
    title: 'At the airport',
    emoji: '✈️',
    icon: Plane,
    setting: 'An airport check-in counter',
    aiRole: 'a check-in agent',
    userGoal: 'Check in for a flight, ask about baggage',
    starter: '您好，请出示您的护照和机票。(Hello, please show your passport and ticket.)',
    hskLevel: 3,
  },
  {
    id: 'work',
    title: 'Job interview',
    emoji: '💼',
    icon: Briefcase,
    setting: 'A company office',
    aiRole: 'an HR manager',
    userGoal: 'Introduce yourself, talk about experience and skills',
    starter: '你好，请坐。先简单介绍一下自己吧。(Hello, please sit. Please introduce yourself.)',
    hskLevel: 4,
  },
  {
    id: 'friend',
    title: 'Catching up with a friend',
    emoji: '🤝',
    icon: Heart,
    setting: 'A casual meeting between friends',
    aiRole: 'your Chinese friend',
    userGoal: 'Make small talk, share updates, suggest plans',
    starter: '好久不见！你最近怎么样？(Long time no see! How have you been?)',
    hskLevel: 2,
  },
  {
    id: 'phone',
    title: 'Phone call',
    emoji: '📞',
    icon: Phone,
    setting: 'A phone call',
    aiRole: 'someone you\'re calling',
    userGoal: 'Make an appointment, ask a question, leave a message',
    starter: '喂，你好。(Hello?)',
    hskLevel: 3,
  },
]

export const SCENARIO_BY_ID: Record<string, ConversationScenario> = CONVERSATION_SCENARIOS.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<string, ConversationScenario>
)

// ── Mode-specific system prompt additions ─────────────────────────────────

export const CONVERSATION_SYSTEM_PROMPT = (scenario: ConversationScenario, hskLevel: number) => `
Conversation mode is active.

You are ${scenario.aiRole}. The setting is: ${scenario.setting}.
The user's goal: ${scenario.userGoal}.
User's HSK level: ${hskLevel || 'unknown'}. Use vocabulary appropriate to this level.

Rules for this mode:
- Stay in character at all times. You are ${scenario.aiRole}, not a tutor.
- Open with this exact line (then continue the scene):
  "${scenario.starter}"
- Keep replies SHORT — 1 to 3 sentences, like a real conversation.
- If the user makes grammar/vocab mistakes, do NOT correct them directly. Instead, naturally rephrase your reply to model the correct form. This is called "recasting" and it helps language learners without breaking conversation flow.
- If the user is clearly stuck or asks for help, you may briefly step out of character to give a one-line hint, then continue the scene.
- Use ${hskLevel && hskLevel <= 2 ? 'simple HSK 1-2 vocabulary' : hskLevel === 3 ? 'HSK 1-3 vocabulary' : 'vocabulary up to HSK 4'}.
- Do NOT use lists, tables, or markdown. Just natural dialogue.
- Do NOT lecture. Be a real conversation partner.
`

export const GRAMMAR_SYSTEM_PROMPT = (patternName: string, patternEn: string, structure: string, examples: string[], hskLevel: number) => `
Grammar mode is active. Focus: **${patternName}** (${patternEn})

Pattern structure: ${structure}

Reference examples:
${examples.map((e) => `- ${e}`).join('\n')}

User's HSK level: ${hskLevel || 'unknown'}. Use vocabulary appropriate to this level.

Rules for this mode:
- Focus each response on the **${patternName}** pattern, unless the user explicitly asks something else.
- Explain the pattern clearly with 1-2 new example sentences each turn.
- Use **markdown tables** when comparing similar patterns or showing transformations.
- After explaining, give the user a small practice prompt: ask them to make a sentence using ${patternName}, or fill in a blank.
- Correct their attempts gently and explain what was wrong.
- If the user is at a lower HSK level, keep example sentences short and use high-frequency vocabulary.
- If the user is more advanced, you can include subtle variations and edge cases.
- Be concise. Don't lecture — teach step by step.
`

export const CHAT_MODE_LABEL = (mode: AIMode): string => AI_MODE_BY_ID[mode].label
