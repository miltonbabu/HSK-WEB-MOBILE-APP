import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useRef } from 'react'
import {
  BookOpen,
  Headphones,
  PenTool,
  MessageSquare,
  Brain,
  Download,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Globe,
} from 'lucide-react'
import SEO from '@/components/SEO/Helmet'
import { AppSchema, FAQSchema } from '@/components/SEO/StructuredData'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'

const FEATURES = [
  {
    icon: BookOpen,
    title: 'HSK 4 Vocabulary Flashcards',
    desc: '1,200+ HSK 4 words with spaced repetition, pinyin, and example sentences. Covers HSK 3.0 new standard.',
    color: 'from-violet-500 to-purple-500',
  },
  {
    icon: Headphones,
    title: 'Listening Comprehension',
    desc: 'Practice HSK 4 listening with native pronunciation and audio playback for every word and sentence.',
    color: 'from-pink-500 to-rose-500',
  },
  {
    icon: PenTool,
    title: 'Handwriting Practice',
    desc: 'Learn to write Chinese characters with stroke order guides and AI-powered handwriting feedback.',
    color: 'from-orange-500 to-amber-500',
  },
  {
    icon: MessageSquare,
    title: 'AI Conversation Partner',
    desc: 'Practice spoken Chinese with AI role-play scenarios: restaurant, shopping, taxi, doctor, job interview.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Brain,
    title: 'AI Smart Review',
    desc: 'Personalized review sessions based on your error patterns and weak areas. Never forget a word again.',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Zap,
    title: 'AI Story Mode',
    desc: 'Read stories crafted from your HSK 4 vocabulary, then test your comprehension with quizzes.',
    color: 'from-fuchsia-500 to-pink-500',
  },
]

const FAQS = [
  {
    question: 'What is HSK 4?',
    answer:
      'HSK 4 (汉语水平考试四级) is the fourth level of the Hanyu Shuiping Kaoshi (Chinese Proficiency Test). It requires knowledge of approximately 1,200 vocabulary words and tests listening, reading, and writing skills. HSK 4 corresponds to intermediate Chinese proficiency, roughly equivalent to B2 on the CEFR scale under the new HSK 3.0 standard.',
  },
  {
    question: 'How many words are in HSK 4?',
    answer:
      'HSK 4 requires mastery of approximately 1,200 vocabulary words (600 new words on top of the 600 words from HSK 1-3). Under the new HSK 3.0 standard, the vocabulary requirements have been expanded to approximately 3,245 words for the intermediate level (bands 4-6).',
  },
  {
    question: 'How long does it take to prepare for HSK 4?',
    answer:
      'Most learners need 3-6 months of dedicated study to prepare for HSK 4, depending on their starting level. With daily practice using spaced repetition flashcards and listening exercises, many students can pass HSK 4 within 3 months. Our AI Smart Review feature helps you focus on your weakest areas for faster progress.',
  },
  {
    question: 'Is this HSK 4 app free?',
    answer:
      'Yes! XueTong is completely free to use. It works as a Progressive Web App (PWA), meaning you can use it offline without an internet connection. All features including AI-powered flashcards, listening practice, handwriting drills, and conversation partner are available at no cost.',
  },
  {
    question: 'Does this app support the new HSK 3.0 standard?',
    answer:
      'Yes, XueTong supports both the current HSK 4 vocabulary list and the new HSK 3.0 standard. As the HSK reform rolls out through 2025-2026, our app is updated to reflect the new 9-band system and expanded vocabulary requirements.',
  },
  {
    question: 'How can I practice spoken Chinese with this app?',
    answer:
      'XueTong offers an AI Conversation Partner feature where you can practice real-life Mandarin dialogues in scenarios like ordering at a restaurant, shopping, taking a taxi, visiting a doctor, or job interviews. The AI provides corrections and pinyin guides for your responses.',
  },
  {
    question: 'What is the best way to learn Chinese vocabulary?',
    answer:
      'Research shows that spaced repetition is the most effective method for memorizing vocabulary. XueTong uses AI-powered spaced repetition to schedule reviews at optimal intervals, ensuring you remember HSK 4 words long-term. Combined with listening practice, handwriting, and conversation, this multi-modal approach leads to faster fluency.',
  },
  {
    question: 'Can I use this app offline?',
    answer:
      'Yes! XueTong is a Progressive Web App (PWA) that works fully offline. Once loaded, all vocabulary data, flashcards, quizzes, and handwriting practice work without an internet connection. AI features can use an in-browser language model (WebLLM) for offline AI-powered feedback.',
  },
]

const STATS = [
  { value: '1,200+', label: 'HSK 4 Words' },
  { value: '7', label: 'AI Learning Modes' },
  { value: '100%', label: 'Free & Offline' },
  { value: '6+', label: 'Countries Served' },
]

const TRUST_BADGES = [
  { icon: Shield, label: 'No ads' },
  { icon: Globe, label: 'Works worldwide' },
  { icon: Download, label: 'Installable PWA' },
]

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const float = {
  animate: {
    y: [0, -12, 0],
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' as const },
  },
}

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  return (
    <>
      <SEO
        title="学通 XueTong — HSK 4 Vocabulary App | Learn Chinese Mandarin | 汉语水平考试备考"
        description="Master HSK 4 vocabulary with AI-powered flashcards, listening practice, handwriting drills, and conversation partner. Covers HSK 3.0 new standard. 1200+ words with pinyin, examples, and spaced repetition. Free offline PWA."
        keywords="HSK4,HSK 4,HSK四级,HSK词汇,HSK4词汇,汉语水平考试,学中文,learn Chinese,learn Mandarin,Chinese vocabulary app,HSK flashcard,HSK practice,HSK备考,中文学习app,spaced repetition,Chinese as second language,spoken Chinese,conversational Mandarin,HSK3.0,HSK 4 vocabulary list,HSK 4 practice test,learn Chinese online,Chinese learning app,HSK4单词,中文口语,学汉语,中文学习软件,AI Chinese tutor,learn Chinese with AI"
      />
      <AppSchema />
      <FAQSchema faqs={FAQS} />

      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white dark:from-gray-950 dark:via-purple-950/20 dark:to-gray-950 overflow-x-hidden">
        {/* Animated background blobs */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <motion.div
            className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0) 70%)',
              filter: 'blur(60px)',
            }}
            animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(236,72,153,0.3) 0%, rgba(236,72,153,0) 70%)',
              filter: 'blur(60px)',
            }}
            animate={{ x: [0, -50, 0], y: [0, 60, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-0 left-1/3 w-[550px] h-[550px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 70%)',
              filter: 'blur(70px)',
            }}
            animate={{ x: [0, 30, 0], y: [0, -40, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* HERO */}
        <section ref={heroRef} className="relative pt-20 pb-24 md:pt-28 md:pb-32">
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="max-w-6xl mx-auto px-4 text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full card-glass border border-purple-200/40 dark:border-purple-700/30 text-purple-700 dark:text-purple-300 text-sm font-medium mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              AI-Powered HSK 4 Learning · 2026 Ready
            </motion.div>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-gray-900 dark:text-white leading-[1.05] tracking-tight mb-6"
            >
              Master{' '}
              <span className="relative inline-block">
                <span className="gradient-text">HSK 4</span>
                <motion.svg
                  className="absolute -bottom-2 left-0 w-full"
                  viewBox="0 0 200 12"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, delay: 0.8 }}
                >
                  <motion.path
                    d="M2 8 Q 50 2, 100 6 T 198 4"
                    stroke="url(#grad-underline)"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="grad-underline" x1="0" x2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </motion.svg>
              </span>
              <br />
              <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-gray-700 dark:text-gray-300">
                学通 Chinese
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              The free AI-powered app to learn HSK 4 words (汉语水平考试四级),
              practice spoken Chinese, and ace your exam.
              <br className="hidden sm:block" />
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                HSK 3.0 ready
              </span>{' '}
              · Works offline · No ads, ever.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
            >
              <Link
                to="/dashboard"
                className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold text-lg overflow-hidden transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 10px 40px rgba(139,92,246,0.4)',
                }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-pink-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                <span className="relative">Start Learning Free</span>
                <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/vocabulary"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg card-glass border-2 border-gray-200/60 dark:border-gray-700/40 text-gray-700 dark:text-gray-200 hover:border-purple-300 dark:hover:border-purple-500 transition-all"
              >
                Browse HSK 4 Words
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400"
            >
              {TRUST_BADGES.map((badge) => (
                <div key={badge.label} className="flex items-center gap-1.5">
                  <badge.icon className="w-4 h-4 text-green-500" />
                  <span>{badge.label}</span>
                </div>
              ))}
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              transition={{ delayChildren: 0.8 }}
              className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
            >
              {STATS.map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={fadeUp}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="card-glass rounded-2xl p-5 text-center"
                >
                  <p className="text-3xl md:text-4xl font-extrabold gradient-text mb-1">
                    {stat.value}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Floating 3D cards preview */}
          <div className="relative max-w-6xl mx-auto px-4 mt-24 hidden md:block">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative h-80"
              style={{ perspective: '1000px' }}
            >
              {/* Center card */}
              <motion.div
                className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 card-glass rounded-3xl p-8 shadow-2xl"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(236,72,153,0.15) 100%)',
                  transformStyle: 'preserve-3d',
                  boxShadow: '0 25px 60px rgba(139,92,246,0.3)',
                }}
                animate={{ rotateY: [0, 5, 0, -5, 0], y: [0, -8, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <p className="text-6xl font-bold text-center chinese-text text-gray-900 dark:text-white mb-2">
                  学习
                </p>
                <p className="text-center text-sm text-gray-600 dark:text-gray-300">
                  xuéxí · to study
                </p>
                <div className="mt-4 flex justify-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                    HSK 4
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300">
                    Verb
                  </span>
                </div>
              </motion.div>

              {/* Left card */}
              <motion.div
                className="absolute left-[10%] top-1/2 w-56 -translate-y-1/2 card-glass rounded-2xl p-5"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%)',
                  transformStyle: 'preserve-3d',
                }}
                variants={float}
                animate="animate"
              >
                <p className="text-4xl font-bold text-center chinese-text text-gray-800 dark:text-gray-100">
                  朋友
                </p>
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                  péngyǒu · friend
                </p>
              </motion.div>

              {/* Right card */}
              <motion.div
                className="absolute right-[10%] top-1/2 w-56 -translate-y-1/2 card-glass rounded-2xl p-5"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(251,146,60,0.1) 100%)',
                  transformStyle: 'preserve-3d',
                }}
                variants={float}
                animate="animate"
                transition={{ delay: 1 }}
              >
                <p className="text-4xl font-bold text-center chinese-text text-gray-800 dark:text-gray-100">
                  工作
                </p>
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                  gōngzuò · work
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="max-w-6xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
              Everything You Need to{' '}
              <span className="gradient-text">Pass HSK 4</span>
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              Seven AI-powered learning modes for HSK 4 exam prep, spoken Chinese practice, and vocabulary mastery.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {FEATURES.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group relative card-glass rounded-2xl p-6 overflow-hidden cursor-default"
              >
                <div
                  className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${feature.color} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`}
                ></div>
                <div
                  className={`relative w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${feature.color} shadow-lg`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Why XueTong */}
        <section className="max-w-4xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
              Why Learners Love <span className="gradient-text">XueTong</span>
            </h2>
          </motion.div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="space-y-3"
          >
            {[
              'Complete HSK 4 vocabulary list — all 1,200 words with pinyin, English, and examples',
              'AI-powered spaced repetition that adapts to your learning pace',
              'HSK 3.0 new standard support — stay ahead of the 2025-2026 reform',
              'Offline PWA — study Chinese anywhere, no internet needed',
              'AI conversation partner for spoken Chinese & conversational Mandarin',
              'Handwriting practice with stroke order + AI feedback',
              'Smart review personalized to your weak spots',
              'Word relationships: synonyms, antonyms, and collocations',
              'Grammar breakdowns that explain why answers are right',
              'Free forever — no subscriptions, no ads, no tricks',
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-start gap-3 card-glass rounded-xl p-4"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <p className="text-gray-700 dark:text-gray-200">{item}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
              HSK 4 <span className="gradient-text">FAQ</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Everything you need to know about HSK 4 and XueTong.
            </p>
          </motion.div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="space-y-4"
          >
            {FAQS.map((faq) => (
              <motion.details
                key={faq.question}
                variants={fadeUp}
                className="group card-glass rounded-2xl p-5 cursor-pointer"
              >
                <summary className="font-semibold text-gray-900 dark:text-white list-none flex items-center justify-between">
                  {faq.question}
                  <span className="ml-4 text-purple-500 group-open:rotate-180 transition-transform text-xl">
                    ▾
                  </span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {faq.answer}
                </p>
              </motion.details>
            ))}
          </motion.div>
        </section>

        {/* FINAL CTA */}
        <section className="max-w-5xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative card-glass rounded-3xl p-10 md:p-16 text-center overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(236,72,153,0.10) 50%, rgba(59,130,246,0.10) 100%)',
            }}
          >
            <motion.div
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-purple-500/20 blur-3xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 8, repeat: Infinity }}
            />
            <motion.div
              className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-pink-500/20 blur-3xl"
              animate={{ scale: [1.2, 1, 1.2] }}
              transition={{ duration: 10, repeat: Infinity }}
            />
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
                Start Your HSK 4 Journey
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-lg mx-auto text-lg">
                Join thousands mastering Chinese Mandarin vocabulary with AI. Free, offline, HSK 3.0 ready.
              </p>
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2 px-10 py-4 rounded-2xl text-white font-semibold text-lg transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 15px 50px rgba(139,92,246,0.5)',
                }}
              >
                <Download className="w-5 h-5" />
                Get Started — It's Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200/50 dark:border-gray-800/50 py-10">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
            <p className="text-base font-semibold gradient-text mb-2">
              学通 XueTong
            </p>
            <p>HSK 4 Vocabulary App · Learn Chinese Mandarin · 汉语水平考试备考</p>
            <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <Link to="/vocabulary" className="hover:text-purple-500 transition-colors">
                HSK 4 Vocabulary
              </Link>
              <span className="text-gray-300">·</span>
              <Link to="/learn" className="hover:text-purple-500 transition-colors">
                Learning Modes
              </Link>
              <span className="text-gray-300">·</span>
              <Link to="/dashboard" className="hover:text-purple-500 transition-colors">
                Dashboard
              </Link>
            </p>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              HSK (汉语水平考试) is the standardized Chinese proficiency test. HSK 4 requires ~1,200 vocabulary words.
              <br />
              This app supports HSK 3.0 new standard (九级制).
            </p>
          </div>
        </footer>
      </div>
      <PwaInstallPrompt />
    </>
  )
}
