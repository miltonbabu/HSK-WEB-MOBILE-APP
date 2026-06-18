import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'
import { initDatabase, query, exec, forceSaveDb } from './services/database'
import { seedVocabulary, invalidateWordsCache } from './services/sqlite-api'

// Auto-reload once on chunk-load failure. This happens after deployments:
// old cached HTML references chunk hashes (e.g. Landing-9dRMkBlR.js) that
// no longer exist on the server. Instead of showing the error screen, we
// silently reload once so the browser fetches fresh HTML with updated hashes.
// A sessionStorage flag prevents infinite reload loops — if it still fails
// after one retry, the AppErrorBoundary shows the manual "Reload" button.
;(() => {
  const RELOAD_FLAG = 'hsk-chunk-reloaded'
  const isChunkLoadError = (msg: string) =>
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')

  const handleFailure = (msg: string) => {
    if (!isChunkLoadError(msg)) return
    if (sessionStorage.getItem(RELOAD_FLAG)) return
    sessionStorage.setItem(RELOAD_FLAG, '1')
    window.location.reload()
  }

  window.addEventListener('error', (e) => {
    if (e.message) handleFailure(e.message)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || String(e.reason || '')
    handleFailure(msg)
  })
  // Clear the flag shortly after load so a future deployment's chunk failure
  // can still auto-recover (not permanently blocked by a stale flag).
  window.addEventListener('load', () => {
    setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000)
  })
})()

const TARGET_WORD_COUNT = 2000

let initPromise: Promise<void> | null = null

function initializeApp(): Promise<void> {
  if (initPromise) return initPromise

  // Fire-and-forget background bootstrap. The React tree mounts immediately;
  // pages that need the DB will `await whenDbReady` before reading.
  // This is the fix for the "first-load white screen" — previously the entire
  // app blocked here on initSqlJs + the 2000+ word JSON fetch.
  initPromise = (async () => {
    try {
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
          invalidateWordsCache()
          console.log(`Seeded ${words.length} vocabulary words into SQLite`)
        } catch (error) {
          console.error('Failed to seed vocabulary data:', error)
        }
      } else {
        console.log(`Database has ${wordCount} words, skipping vocabulary seed.`)
      }
    } catch (error) {
      console.error('App initialization failed:', error)
    }
  })()

  return initPromise
}

// Kick off DB init in the background. We deliberately do NOT await this here
// so React renders immediately and the user sees a splash + landing page even
// on a cold start. Pages read from the DB only after `whenDbReady` resolves.
const whenDbReady = initializeApp()

// Pre-warm the words cache as soon as the DB is ready (in the background).
// This way the first call to wordService.getAll() from a page component
// returns instantly instead of stalling on a 2000+ row query + JSON parse.
whenDbReady.then(() => {
  void import('./services/sqlite-api').then(({ wordService }) => wordService.getAll())
})

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
