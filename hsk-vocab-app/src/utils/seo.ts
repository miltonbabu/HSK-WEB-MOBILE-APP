// SEO utility functions and keyword maps for multi-engine optimization

// Page-specific SEO configurations
export const PAGE_SEO: Record<string, { title: string; description: string; keywords: string }> = {
  landing: {
    title: '学通 XueTong — HSK 4 Vocabulary App | Learn Chinese Mandarin | 汉语水平考试备考',
    description: 'Master HSK 4 vocabulary with AI-powered flashcards, listening practice, handwriting drills, and conversation partner. Covers HSK 3.0 new standard. 1200+ words with pinyin, examples, and spaced repetition. Free offline PWA.',
    keywords: 'HSK4,HSK 4,HSK四级,HSK词汇,汉语水平考试,学中文,learn Chinese,learn Mandarin,Chinese vocabulary app,HSK flashcard,spaced repetition,Chinese as second language,spoken Chinese,conversational Mandarin,HSK3.0',
  },
  vocabulary: {
    title: 'HSK 4 Vocabulary List — 1200+ Words with Pinyin | HSK四级词汇表',
    description: 'Complete HSK 4 vocabulary list with 1,200+ words, pinyin, English translations, and example sentences. Search, filter, and study HSK 4 words (HSK四级词汇表). Supports HSK 3.0 new standard.',
    keywords: 'HSK 4 vocabulary list,HSK4词汇表,HSK 4 words,pinyin,HSK四级单词,vocabulary with examples,Chinese vocabulary,HSK 4 word list 1200,HSK4词汇,中文词汇',
  },
  learn: {
    title: 'HSK 4 Learning Modes — Flashcards, Listening, Handwriting, AI Conversation | HSK4学习模式',
    description: 'Seven AI-powered learning modes for HSK 4: flashcards with spaced repetition, listening comprehension, handwriting practice, AI conversation partner, story mode, smart review, and grammar breakdown.',
    keywords: 'HSK 4 flashcards,HSK4学习,Chinese listening practice,handwriting Chinese,AI conversation Chinese,HSK practice,spaced repetition Chinese,Chinese learning modes',
  },
  dashboard: {
    title: 'HSK 4 Study Dashboard — Track Progress & AI Daily Digest | HSK4学习仪表板',
    description: 'Track your HSK 4 study progress with AI-powered daily digest, streak tracking, weak word analysis, and personalized review recommendations.',
    keywords: 'HSK 4 study progress,Chinese learning dashboard,HSK study tracker,AI daily digest,Chinese vocabulary progress',
  },
  story: {
    title: 'AI Story Mode — Learn Chinese Through Stories | HSK4故事学习',
    description: 'Read AI-generated stories crafted from your HSK 4 vocabulary, then test your comprehension with quizzes. A fun way to learn Chinese through context.',
    keywords: 'learn Chinese through stories,HSK 4 reading,Chinese story practice,AI story Chinese,Chinese comprehension,HSK4阅读,中文故事',
  },
  conversation: {
    title: 'AI Conversation Partner — Practice Spoken Chinese | 中文口语练习',
    description: 'Practice spoken Chinese with AI role-play in real-life scenarios: restaurant, shopping, taxi, doctor, job interview. Get corrections and pinyin guides.',
    keywords: 'spoken Chinese,conversational Mandarin,Chinese speaking practice,AI conversation Chinese,Chinese role play,中文口语,汉语口语,Chinese for travel,business Chinese',
  },
  'smart-review': {
    title: 'AI Smart Review — Personalized HSK 4 Review Sessions | HSK4智能复习',
    description: 'AI-powered personalized review sessions based on your error patterns and weak areas. Never forget HSK 4 vocabulary again with smart spaced repetition.',
    keywords: 'HSK 4 review,smart review Chinese,personalized study,spaced repetition,HSK preparation,weak words review,HSK4复习,智能复习',
  },
  handwriting: {
    title: 'Chinese Handwriting Practice — Stroke Order & AI Feedback | 汉字书写练习',
    description: 'Practice writing Chinese characters with stroke order guides and AI-powered feedback on structure and form. Master HSK 4 handwriting.',
    keywords: 'Chinese handwriting,stroke order,character writing practice,汉字书写,笔顺,Chinese writing app,HSK 4 writing,汉字练习',
  },
}

// Country-specific keyword variations for hreflang pages
export const LOCALIZED_KEYWORDS: Record<string, string> = {
  en: 'HSK 4 vocabulary, learn Chinese, Chinese vocabulary app, HSK flashcard, spoken Chinese, conversational Mandarin',
  zh: 'HSK4词汇,学中文,中文学习app,HSK备考,中文口语,汉语水平考试',
  ko: 'HSK 4 단어, 중국어 배우기, HSK 플래시카드, 중국어 회화, 한어수평고시',
  ja: 'HSK 4 単語, 中国語学習, HSK フラッシュカード, 中国語会話, 中国語検定',
  vi: 'HSK 4 từ vựng, học tiếng Trung, thẻ ghi nhớ HSK, hội thoại tiếng Hoa, luyện thi HSK',
  th: 'HSK 4 คำศัพท์, เรียนภาษาจีน, แฟลชการ์ด HSK, สนทนาภาษาจีน, เตรียมสอบ HSK',
  id: 'HSK 4 kosakata, belajar bahasa Mandarin, flashcard HSK, percakapan Mandarin, persiapan HSK',
  ru: 'HSK 4 словарь, учить китайский, карточки HSK, разговорный китайский, подготовка HSK',
  fr: 'HSK 4 vocabulaire, apprendre le chinois, flashcards HSK, chinois parlé, préparation HSK',
  de: 'HSK 4 Vokabeln, Chinesisch lernen, HSK Karteikarten, Chinesisch sprechen, HSK Vorbereitung',
}

// Generate year-based keywords for future-proofing
export function generateYearKeywords(baseKeyword: string, startYear = 2026, endYear = 2036): string[] {
  const keywords: string[] = []
  for (let year = startYear; year <= endYear; year++) {
    keywords.push(`${baseKeyword} ${year}`)
  }
  return keywords
}

// HSK 4 year-based keywords for meta tags
export const HSK4_YEAR_KEYWORDS = generateYearKeywords('HSK 4').join(',')
export const HSK_EXAM_YEAR_KEYWORDS = generateYearKeywords('HSK exam').join(',')
export const LEARN_CHINESE_YEAR_KEYWORDS = generateYearKeywords('learn Chinese').join(',')

// Baidu-specific meta keywords (Baidu still uses meta keywords)
export const BAIDU_KEYWORDS = [
  'HSK4', 'HSK四级', 'HSK考试', '汉语水平考试', 'HSK4词汇', 'HSK4单词',
  'HSK4真题', 'HSK4备考', '学中文', '学汉语', '中文学习', '汉语学习',
  '学中文app', '中文学习软件', 'HSK词汇表', '中文口语', '汉语口语',
  '中文词汇', 'HSK4模拟考试', 'HSK报名', 'HSK考试时间', 'HSK成绩查询',
  '间隔重复', '记忆卡片', '单词记忆法', '汉字学习', '拼音学习',
  '中文语法', '中文听力练习', '中文阅读练习', '学普通话', '普通话学习',
].join(',')

// Generate sitemap entries
export function generateSitemapEntries(baseUrl = 'https://xuetong.app'): string[] {
  const pages = [
    '',
    '/vocabulary',
    '/learn',
    '/dashboard',
    '/mode/flashcard',
    '/mode/listening',
    '/mode/timed-quiz',
    '/mode/sequential-quiz',
    '/mode/visual',
    '/mode/sentence-making',
    '/mode/sentence-puzzle',
    '/mode/translation',
    '/mode/shadowing',
    '/mode/handwriting',
    '/mode/story',
    '/mode/conversation',
    '/mode/smart-review',
  ]
  return pages.map((page) => `${baseUrl}${page}`)
}
