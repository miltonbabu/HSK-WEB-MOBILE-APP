import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'
import { initDatabase, query, exec, forceSaveDb } from './services/database'
import { seedVocabulary } from './services/sqlite-api'

const TARGET_WORD_COUNT = 2000

let initPromise: Promise<void> | null = null

function initializeApp(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    await initDatabase()

    const wordCount = (() => {
      try {
        const result = query('SELECT COUNT(*) as count FROM words')
        return (result[0]?.count || 0) as number
      } catch {
        return 0
      }
    })()

    const needsVocabularySeed = wordCount < TARGET_WORD_COUNT

    if (needsVocabularySeed) {
      try {
        const response = await fetch('/hsk_vocabulary_complete.json')
        const vocabularyData = await response.json()

        const words = vocabularyData.words.map((word: any) => ({
          hsk_level: word.hsk_level,
          chinese: word.chinese,
          pinyin: word.pinyin,
          english: word.english || '',
          pos: Array.isArray(word.pos) ? JSON.stringify(word.pos) : word.pos,
          pos_raw: word.pos_raw || '',
          category: word.topic_category || '',
          example_sentences: Array.isArray(word.example_sentences) ? JSON.stringify(word.example_sentences) : '[]',
          radical: word.radical || '',
          stroke_count: word.stroke_count || 0,
        }))

        exec('DELETE FROM words')
        await seedVocabulary(words)
        console.log(`Seeded ${words.length} vocabulary words into SQLite`)
      } catch (error) {
        console.error('Failed to seed vocabulary data:', error)
      }
    } else {
      console.log(`Database has ${wordCount} words, skipping vocabulary seed.`)
    }
  })()

  return initPromise
}

// Fire-and-forget: initialize the DB in the background. The React app starts
// immediately and pages that need DB access will await `initializeApp()` via
// a shared `whenDbReady` promise below.
const whenDbReady = initializeApp()

export { whenDbReady }

// Save the database when the user leaves the page
function attachUnloadHandler() {
  const handleBeforeUnload = () => {
    try {
      forceSaveDb()
    } catch {
      /* noop */
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
}

const rootElement = document.getElementById('root')!
// Reuse existing root during HMR to avoid ReactDOM.createRoot double-mount warning.
const existingRoot = (rootElement as any)._reactRoot
if (!existingRoot) {
  ;(rootElement as any)._reactRoot = ReactDOM.createRoot(rootElement)
}
;(rootElement as any)._reactRoot.render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
)

attachUnloadHandler()

// Register service worker for PWA install prompt
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err)
    })
  })
}
