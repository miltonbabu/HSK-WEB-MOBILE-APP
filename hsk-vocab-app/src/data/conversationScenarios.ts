import { LucideIcon, ChefHat, MapPin, ShoppingBag, Hotel, Stethoscope, Coffee, Plane, Briefcase, Heart, Phone, Car, Train, Banknote, Library, Scissors, Cake, CloudSun, Dumbbell, Mail, Key } from 'lucide-react'

export interface ConversationScenario {
  id: string
  title: string
  emoji: string
  icon: LucideIcon
  setting: string
  aiRole: string
  userGoal: string
  starter: string
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
  {
    id: 'taxi',
    title: 'Taking a taxi',
    emoji: '🚖',
    icon: Car,
    setting: 'A taxi in the city',
    aiRole: 'a taxi driver',
    userGoal: 'Tell the driver your destination, ask about the fare, make small talk',
    starter: '您好！请问去哪儿？(Hello! Where to?)',
    hskLevel: 1,
  },
  {
    id: 'train-station',
    title: 'Buying train tickets',
    emoji: '🚄',
    icon: Train,
    setting: 'A train station ticket counter',
    aiRole: 'a ticket seller',
    userGoal: 'Buy a ticket, choose seat type, ask about departure time',
    starter: '您好！请问去哪里？要什么时候的票？(Hello! Where to? When do you want to go?)',
    hskLevel: 2,
  },
  {
    id: 'bank',
    title: 'At the bank',
    emoji: '🏦',
    icon: Banknote,
    setting: 'A bank counter',
    aiRole: 'a bank teller',
    userGoal: 'Open an account, exchange money, ask about services',
    starter: '您好，请问您需要办理什么业务？(Hello, what service do you need?)',
    hskLevel: 3,
  },
  {
    id: 'library',
    title: 'At the library',
    emoji: '📚',
    icon: Library,
    setting: 'A university library',
    aiRole: 'a librarian',
    userGoal: 'Find a book, apply for a library card, ask about opening hours',
    starter: '你好！需要帮忙找书吗？(Hi! Need help finding a book?)',
    hskLevel: 2,
  },
  {
    id: 'haircut',
    title: 'At the hair salon',
    emoji: '💇',
    icon: Scissors,
    setting: 'A hair salon',
    aiRole: 'a hairstylist',
    userGoal: 'Describe the haircut you want, ask about price, make small talk',
    starter: '欢迎光临！请问想剪什么样的发型？(Welcome! What kind of haircut would you like?)',
    hskLevel: 3,
  },
  {
    id: 'birthday',
    title: 'At a birthday party',
    emoji: '🎂',
    icon: Cake,
    setting: 'A friend\'s birthday party',
    aiRole: 'the birthday person',
    userGoal: 'Give a gift, say birthday wishes, chat with guests',
    starter: '谢谢你来了！今天玩得开心哦！(Thanks for coming! Have fun today!)',
    hskLevel: 2,
  },
  {
    id: 'weather',
    title: 'Talking about weather',
    emoji: '🌤️',
    icon: CloudSun,
    setting: 'A casual chat about the weather',
    aiRole: 'a friend or colleague',
    userGoal: 'Discuss the weather, make plans based on the forecast',
    starter: '今天天气真不错！你周末有什么计划吗？(The weather is great today! Any plans for the weekend?)',
    hskLevel: 1,
  },
  {
    id: 'gym',
    title: 'At the gym',
    emoji: '🏋️',
    icon: Dumbbell,
    setting: 'A fitness center',
    aiRole: 'a gym trainer',
    userGoal: 'Sign up for membership, ask about equipment, schedule a class',
    starter: '你好！第一次来吗？想了解一下健身吗？(Hi! First time here? Want to learn about fitness?)',
    hskLevel: 3,
  },
  {
    id: 'post-office',
    title: 'At the post office',
    emoji: '📮',
    icon: Mail,
    setting: 'A post office counter',
    aiRole: 'a postal worker',
    userGoal: 'Send a package, buy stamps, ask about delivery time',
    starter: '您好！请问要寄什么？(Hello! What would you like to send?)',
    hskLevel: 2,
  },
  {
    id: 'apartment',
    title: 'Renting an apartment',
    emoji: '🏠',
    icon: Key,
    setting: 'An apartment viewing',
    aiRole: 'a landlord',
    userGoal: 'Ask about rent, utilities, location, and contract terms',
    starter: '你好！来来来，这是客厅，那边是卧室。(Hi! Come in. This is the living room, the bedroom is over there.)',
    hskLevel: 4,
  },
]

export const SCENARIO_BY_ID: Record<string, ConversationScenario> = CONVERSATION_SCENARIOS.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<string, ConversationScenario>
)

export const CONVERSATION_SYSTEM_PROMPT = (scenario: ConversationScenario, hskLevel: number) => `
Conversation mode is active.

You are ${scenario.aiRole}. The setting is: ${scenario.setting}.
The user's goal: ${scenario.userGoal}.
User's HSK level: ${hskLevel || 'unknown'}. Use vocabulary appropriate to this level.

Rules for this mode:
- Stay in character at all times. You are ${scenario.aiRole}, not a tutor.
- Open with this exact line (then continue the scene):
  "${scenario.starter}"
- Reply in CHINESE ONLY. Do NOT include pinyin, English translations, or parenthetical explanations in your replies. Just pure Chinese dialogue.
- The user can write in English or Chinese — either way, you always reply in Chinese.
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
- **Respond in English.** Use English for all explanations, instructions, and teaching content. Keep Chinese only inside the example sentences and pattern names. Do not write explanations in Chinese.
- Focus each response on the **${patternName}** pattern, unless the user explicitly asks something else.
- Explain the pattern clearly with 1-2 new example sentences each turn.
- For every example sentence, give the Chinese sentence, pinyin, and English translation.
- Use **markdown tables** when comparing similar patterns or showing transformations.
- After explaining, give the user a small practice prompt: ask them to make a sentence using ${patternName}, or fill in a blank.
- Correct their attempts gently and explain what was wrong.
- If the user is at a lower HSK level, keep example sentences short and use high-frequency vocabulary.
- If the user is more advanced, you can include subtle variations and edge cases.
- Be concise. Don't lecture — teach step by step.
`