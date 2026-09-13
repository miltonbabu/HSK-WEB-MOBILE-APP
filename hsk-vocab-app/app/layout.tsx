import type { Metadata, Viewport } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: '学通 XueTong — HSK 4 Vocabulary App | Learn Chinese Mandarin | 汉语水平考试备考',
  description:
    'Master HSK 4 vocabulary with AI-powered flashcards, listening practice, handwriting drills, and conversation partner. Covers HSK 3.0 new standard. 1200+ words with pinyin, examples, and spaced repetition. Free offline PWA.',
  keywords:
    'HSK4,HSK 4,HSK四级,HSK词汇,HSK4词汇,汉语水平考试,学中文,learn Chinese,learn Mandarin,Chinese vocabulary app,HSK flashcard,HSK practice,HSK备考,中文学习app,spaced repetition,Chinese as second language,spoken Chinese,conversational Mandarin,HSK3.0,HSK 4 vocabulary,HSK 4 test,HSK 4 practice test,learn Chinese online,Chinese learning app,HSK4单词,中文口语,学汉语,中文学习软件',
  authors: [{ name: 'XueTong' }],
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  alternates: {
    canonical: 'https://xuetong.app',
    languages: {
      'en': 'https://xuetong.app',
      'zh-Hans': 'https://xuetong.app/zh',
      'ko': 'https://xuetong.app/ko',
      'ja': 'https://xuetong.app/ja',
      'vi': 'https://xuetong.app/vi',
      'th': 'https://xuetong.app/th',
      'id': 'https://xuetong.app/id',
      'ru': 'https://xuetong.app/ru',
      'fr': 'https://xuetong.app/fr',
      'de': 'https://xuetong.app/de',
      'x-default': 'https://xuetong.app',
    },
  },
  openGraph: {
    type: 'website',
    title: '学通 XueTong — HSK 4 Vocabulary App | Learn Chinese Mandarin',
    description:
      'Master HSK 4 vocabulary with AI-powered flashcards, listening, handwriting & conversation. HSK 3.0 ready. Free offline PWA.',
    url: 'https://xuetong.app',
    siteName: '学通 XueTong',
    locale: 'en_US',
    alternateLocale: ['zh_CN', 'ko_KR', 'ja_JP', 'vi_VN', 'th_TH', 'id_ID', 'ru_RU', 'fr_FR', 'de_DE'],
    images: [
      {
        url: 'https://xuetong.app/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '学通 XueTong — HSK 4 Vocabulary App',
    description:
      'Master HSK 4 vocabulary with AI-powered flashcards, listening, handwriting & conversation practice.',
    images: ['https://xuetong.app/og-image.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-180.png', sizes: '180x180' },
      { url: '/icon-192.png', sizes: '192x192' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'XueTong',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#8b5cf6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
        />
        <meta name="baidu-site-verification" content="PLACEHOLDER_BAIDU_CODE" />
        <meta name="msvalidate.01" content="PLACEHOLDER_BING_CODE" />
        <meta name="google-site-verification" content="PLACEHOLDER_GOOGLE_CODE" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}