import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { initDatabase, query, exec, forceSaveDb } from './services/database'
import { seedVocabulary } from './services/sqlite-api'

const TARGET_WORD_COUNT = 2000

let initPromise: Promise<void> | null = null

function initializeApp(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    await initDatabase();

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
        const response = await fetch('/hsk_vocabulary_complete.json');
        const vocabularyData = await response.json();

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
        }));

        exec('DELETE FROM words');
        await seedVocabulary(words);
        console.log(`Seeded ${words.length} vocabulary words into SQLite`);
      } catch (error) {
        console.error('Failed to seed vocabulary data:', error);
      }
    } else {
      console.log(`Database has ${wordCount} words, skipping vocabulary seed.`);
    }

    // Skip seeding fake users — ranking is now based on real Supabase data
    // (previously: seedTestUsers() would create fake demo users for local ranking
  })();

  return initPromise;
}

function AppLoader() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initializeApp().then(() => setReady(true))

    // Save database when the user leaves the page
    const handleBeforeUnload = () => {
      try { forceSaveDb() } catch {}
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Loading XueTong...</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Initializing database</p>
      </div>
    )
  }

  return <App />
}

const rootElement = document.getElementById('root')!
// Reuse existing root during HMR to avoid ReactDOM.createRoot double-mount warning.
const existingRoot = (rootElement as any)._reactRoot
if (!existingRoot) {
  ;(rootElement as any)._reactRoot = ReactDOM.createRoot(rootElement)
}
;(rootElement as any)._reactRoot.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppLoader />
    </BrowserRouter>
  </React.StrictMode>,
)
