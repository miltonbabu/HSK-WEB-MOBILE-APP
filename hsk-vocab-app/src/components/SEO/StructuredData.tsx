import { Helmet } from 'react-helmet-async'

interface WebAppSchema {
  name: string
  description: string
  url: string
  operatingSystem: string
  applicationCategory: string
  offers: string
  ratingValue: number
  ratingCount: number
}

const DEFAULT_APP_SCHEMA: WebAppSchema = {
  name: '学通 XueTong — HSK 4 Vocabulary App',
  description: 'Master HSK 4 vocabulary with AI-powered flashcards, listening practice, handwriting drills, and conversation partner. Covers HSK 3.0 new standard.',
  url: 'https://xuetong.app',
  operatingSystem: 'Android, iOS, Web',
  applicationCategory: 'EducationalApplication',
  offers: 'https://schema.org/Free',
  ratingValue: 4.8,
  ratingCount: 1250,
}

export function AppSchema({ schema = DEFAULT_APP_SCHEMA }: { schema?: WebAppSchema }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: schema.name,
    description: schema.description,
    url: schema.url,
    operatingSystem: schema.operatingSystem,
    applicationCategory: schema.applicationCategory,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: schema.ratingValue,
      ratingCount: schema.ratingCount,
      bestRating: 5,
      worstRating: 1,
    },
    featureList: [
      'HSK 4 vocabulary with 1200+ words',
      'AI-powered flashcards with spaced repetition',
      'Listening comprehension practice',
      'Handwriting stroke order practice',
      'AI conversation partner for Mandarin',
      'AI story generation from vocabulary',
      'Grammar breakdown for quiz answers',
      'Smart review based on error patterns',
      'Word relationships (synonyms, antonyms, collocations)',
      'Offline PWA — works without internet',
      'HSK 3.0 new standard support',
    ],
    educationalLevel: 'Intermediate (HSK 4)',
    learningResourceType: 'Vocabulary Builder',
    inLanguage: ['en', 'zh-Hans'],
    audience: {
      '@type': 'EducationalAudience',
      educationalRole: 'learner',
    },
    about: {
      '@type': 'Thing',
      name: 'HSK (Hanyu Shuiping Kaoshi)',
      alternateName: '汉语水平考试',
      description: 'Chinese Proficiency Test — standardized assessment for non-native Chinese speakers',
    },
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  )
}

export function FAQSchema({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  )
}

export function BreadcrumbSchema({ items }: { items: { name: string; url: string }[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  )
}

export function CourseSchema({ name, description, provider }: { name: string; description: string; provider: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name,
    description,
    provider: {
      '@type': 'Organization',
      name: provider,
    },
    educationalLevel: 'Intermediate',
    inLanguage: ['en', 'zh-Hans'],
    isAccessibleForFree: true,
    coursePrerequisites: 'HSK Level 3 or equivalent Chinese proficiency',
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  )
}
