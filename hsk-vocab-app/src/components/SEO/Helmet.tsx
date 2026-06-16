import { Helmet as ReactHelmet } from 'react-helmet-async'

interface SEOProps {
  title?: string
  description?: string
  keywords?: string
  canonical?: string
  ogImage?: string
  ogType?: string
  lang?: string
  noindex?: boolean
}

const DEFAULTS = {
  title: '学通 XueTong — HSK 4 Vocabulary App | Learn Chinese Mandarin | 汉语水平考试备考',
  description: 'Master HSK 4 vocabulary with AI-powered flashcards, listening practice, handwriting drills, and conversation partner. Covers HSK 3.0 new standard. 1200+ words with pinyin, examples, and spaced repetition. Free offline PWA.',
  keywords: 'HSK4,HSK 4,HSK四级,HSK词汇,汉语水平考试,学中文,learn Chinese,learn Mandarin,Chinese vocabulary app,HSK flashcard,spaced repetition,Chinese as second language,spoken Chinese,conversational Mandarin,HSK3.0',
  canonical: 'https://xuetong.app',
  ogImage: 'https://xuetong.app/og-image.png',
  ogType: 'website',
  lang: 'zh-Hans',
}

export default function SEO({
  title = DEFAULTS.title,
  description = DEFAULTS.description,
  keywords = DEFAULTS.keywords,
  canonical = DEFAULTS.canonical,
  ogImage = DEFAULTS.ogImage,
  ogType = DEFAULTS.ogType,
  lang = DEFAULTS.lang,
  noindex = false,
}: SEOProps) {
  return (
    <ReactHelmet>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="学通 XueTong" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </ReactHelmet>
  )
}
