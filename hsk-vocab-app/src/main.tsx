import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { initDatabase, hasData, query, exec } from './services/database'
import { seedVocabulary, seedTestUsers } from './services/sqlite-api'

const TARGET_WORD_COUNT = 2000

let initPromise: Promise<void> | null = null

function initializeApp(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    await initDatabase();

    const needsSeed = !hasData() || (() => {
      try {
        const result = query('SELECT COUNT(*) as count FROM words')
        return (result[0]?.count || 0) < TARGET_WORD_COUNT
      } catch {
        return true
      }
    })()

    if (needsSeed) {
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
        await seedTestUsers();
        console.log(`Seeded ${words.length} vocabulary words into SQLite`);
      } catch (error) {
        console.error('Failed to seed vocabulary data:', error);
      }
    } else {
      console.log('Database already seeded, skipping...');
    }
  })();

  return initPromise;
}

function AppLoader() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initializeApp().then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Loading My HSK...</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Initializing database</p>
      </div>
    )
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppLoader />
    </BrowserRouter>
  </React.StrictMode>,
)
