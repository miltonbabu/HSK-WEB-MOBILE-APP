import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { BookOpen, Headphones, PenTool, MessageSquare, Brain, Sparkles, Download, CheckCircle2, ArrowRight } from 'lucide-react'
import SEO from '@/components/SEO/Helmet'
import { AppSchema, FAQSchema } from '@/components/SEO/StructuredData'

const FEATURES = [
  { icon: BookOpen, title: 'HSK 4 Vocabulary Flashcards', desc: '1200+ HSK 4 words with spaced repetition, pinyin, and example sentences. Covers HSK 3.0 new standard.' },
  { icon: Headphones, title: 'Listening Comprehension', desc: 'Practice HSK 4 listening with native pronunciation and audio playback for every word and sentence.' },
  { icon: PenTool, title: 'Handwriting Practice', desc: 'Learn to write Chinese characters with stroke order guides and AI-powered handwriting feedback.' },
  { icon: MessageSquare, title: 'AI Conversation Partner', desc: 'Practice spoken Chinese with AI role-play scenarios: restaurant, shopping, taxi, doctor, job interview.' },
  { icon: Brain, title: 'AI Smart Review', desc: 'Personalized review sessions based on your error patterns and weak areas. Never forget a word again.' },
  { icon: Sparkles, title: 'AI Story Mode', desc: 'Read stories crafted from your HSK 4 vocabulary, then test your comprehension with quizzes.' },
]

const FAQS = [
  { question: 'What is HSK 4?', answer: 'HSK 4 (汉语水平考试四级) is the fourth level of the Hanyu Shuiping Kaoshi (Chinese Proficiency Test). It requires knowledge of approximately 1,200 vocabulary words and tests listening, reading, and writing skills. HSK 4 corresponds to intermediate Chinese proficiency, roughly equivalent to B2 on the CEFR scale under the new HSK 3.0 standard.' },
  { question: 'How many words are in HSK 4?', answer: 'HSK 4 requires mastery of approximately 1,200 vocabulary words (600 new words on top of the 600 words from HSK 1-3). Under the new HSK 3.0 standard, the vocabulary requirements have been expanded to approximately 3,245 words for the intermediate level (bands 4-6).' },
  { question: 'How long does it take to prepare for HSK 4?', answer: 'Most learners need 3-6 months of dedicated study to prepare for HSK 4, depending on their starting level. With daily practice using spaced repetition flashcards and listening exercises, many students can pass HSK 4 within 3 months. Our AI Smart Review feature helps you focus on your weakest areas for faster progress.' },
  { question: 'Is this HSK 4 app free?', answer: 'Yes! XueTong is completely free to use. It works as a Progressive Web App (PWA), meaning you can use it offline without an internet connection. All features including AI-powered flashcards, listening practice, handwriting drills, and conversation partner are available at no cost.' },
  { question: 'Does this app support the new HSK 3.0 standard?', answer: 'Yes, XueTong supports both the current HSK 4 vocabulary list and the new HSK 3.0 standard. As the HSK reform rolls out through 2025-2026, our app is updated to reflect the new 9-band system and expanded vocabulary requirements.' },
  { question: 'How can I practice spoken Chinese with this app?', answer: 'XueTong offers an AI Conversation Partner feature where you can practice real-life Mandarin dialogues in scenarios like ordering at a restaurant, shopping, taking a taxi, visiting a doctor, or job interviews. The AI provides corrections and pinyin guides for your responses.' },
  { question: 'What is the best way to learn Chinese vocabulary?', answer: 'Research shows that spaced repetition is the most effective method for memorizing vocabulary. XueTong uses AI-powered spaced repetition to schedule reviews at optimal intervals, ensuring you remember HSK 4 words long-term. Combined with listening practice, handwriting, and conversation, this multi-modal approach leads to faster fluency.' },
  { question: 'Can I use this app offline?', answer: 'Yes! XueTong is a Progressive Web App (PWA) that works fully offline. Once loaded, all vocabulary data, flashcards, quizzes, and handwriting practice work without an internet connection. AI features can use an in-browser language model (WebLLM) for offline AI-powered feedback.' },
]

const STATS = [
  { value: '1,200+', label: 'HSK 4 Words' },
  { value: '7', label: 'Learning Modes' },
  { value: '100%', label: 'Free & Offline' },
  { value: 'AI', label: 'Powered' },
]

export default function Landing() {
  return (
    <>
      <SEO
        title="学通 XueTong — HSK 4 Vocabulary App | Learn Chinese Mandarin | 汉语水平考试备考"
        description="Master HSK 4 vocabulary with AI-powered flashcards, listening practice, handwriting drills, and conversation partner. Covers HSK 3.0 new standard. 1200+ words with pinyin, examples, and spaced repetition. Free offline PWA."
        keywords="HSK4,HSK 4,HSK四级,HSK词汇,HSK4词汇,汉语水平考试,学中文,learn Chinese,learn Mandarin,Chinese vocabulary app,HSK flashcard,HSK practice,HSK备考,中文学习app,spaced repetition,Chinese as second language,spoken Chinese,conversational Mandarin,HSK3.0,HSK 4 vocabulary list,HSK 4 practice test,learn Chinese online,Chinese learning app,HSK4单词,中文口语,学汉语,中文学习软件,AI Chinese tutor,learn Chinese with AI"
      />
      <AppSchema />
      <FAQSchema faqs={FAQS} />

      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white dark:from-gray-950 dark:via-purple-950/10 dark:to-gray-950">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 pt-16 pb-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" /> AI-Powered HSK 4 Learning
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight mb-4">
              Master <span className="gradient-text">HSK 4</span> Vocabulary
              <br />
              <span className="text-3xl sm:text-4xl md:text-5xl">学通 — Learn Chinese Mandarin</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
              The free AI-powered app to learn HSK 4 words (汉语水平考试四级), practice spoken Chinese, and ace your exam.
              Covers <strong>HSK 3.0 new standard</strong>. Works offline.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-semibold text-lg transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', boxShadow: '0 8px 25px rgba(139,92,246,0.35)' }}>
                Start Learning Free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/vocabulary" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-semibold text-lg border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600 transition-all">
                Browse HSK 4 Words
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold gradient-text">{stat.value}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Everything You Need to Pass HSK 4
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-xl mx-auto">
            Seven AI-powered learning modes designed for HSK 4 exam preparation, spoken Chinese practice, and vocabulary mastery.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="card p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why XueTong */}
        <section className="max-w-4xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Why Choose XueTong for HSK 4 Preparation?
          </h2>
          <div className="space-y-4">
            {[
              'Complete HSK 4 vocabulary list with all 1,200 words, pinyin, English translations, and example sentences',
              'AI-powered spaced repetition system that adapts to your learning pace and error patterns',
              'HSK 3.0 new standard support — stay ahead of the HSK reform rolling out in 2025-2026',
              'Offline PWA — study Chinese vocabulary anywhere without internet connection',
              'AI conversation partner for spoken Chinese and conversational Mandarin practice',
              'Handwriting practice with stroke order guides and AI feedback on character structure',
              'Smart review sessions personalized to your weak areas and common mistakes',
              'Word relationships showing synonyms, antonyms, and collocations for deeper understanding',
              'Grammar breakdowns that explain why answers are correct in quiz mode',
              'Free forever — no subscriptions, no hidden fees, no ads',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
            HSK 4 FAQ — Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <details key={faq.question} className="card p-5 group cursor-pointer">
                <summary className="font-semibold text-gray-900 dark:text-white list-none flex items-center justify-between">
                  {faq.question}
                  <span className="text-purple-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="card p-10" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(236,72,153,0.06) 100%)' }}>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Start Your HSK 4 Journey Today
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-lg mx-auto">
              Join thousands of learners mastering Chinese Mandarin vocabulary with AI-powered tools. Free, offline, and HSK 3.0 ready.
            </p>
            <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-semibold text-lg transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', boxShadow: '0 8px 25px rgba(139,92,246,0.35)' }}>
              <Download className="w-5 h-5" /> Start Learning — It's Free
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-800 py-8">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>学通 XueTong — HSK 4 Vocabulary App | Learn Chinese Mandarin | 汉语水平考试备考</p>
            <p className="mt-2">
              <Link to="/vocabulary" className="hover:text-purple-500 transition-colors">HSK 4 Vocabulary List</Link>
              {' · '}
              <Link to="/learn" className="hover:text-purple-500 transition-colors">Learning Modes</Link>
              {' · '}
              <Link to="/dashboard" className="hover:text-purple-500 transition-colors">Dashboard</Link>
            </p>
            <p className="mt-2 text-xs">
              HSK (汉语水平考试) is the standardized Chinese proficiency test. HSK 4 requires ~1,200 vocabulary words.
              This app supports HSK 3.0 new standard (九级制).
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
