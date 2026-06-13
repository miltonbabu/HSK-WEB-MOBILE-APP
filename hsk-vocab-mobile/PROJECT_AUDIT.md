# HSK Vocab Mobile — Project Audit

**Date:** 2026-06-10
**SDK:** Expo 56 (React Native 0.85.3, React 19.2.3)

---

## 1. SDK & Dependencies

| Package | Version | Status |
|---|---|---|
| expo | ~56.0.9 | OK — SDK 56 |
| react | 19.2.3 | OK |
| react-native | 0.85.3 | OK |
| expo-router | ~56.2.9 | OK — file-based routing |
| expo-sqlite | ~56.0.4 | OK — local DB |
| expo-speech | ~56.0.3 | OK — TTS |
| expo-crypto | ~56.0.4 | OK — password hashing |
| expo-clipboard | ~56.0.4 | OK |
| expo-haptics | ~56.0.3 | OK |
| nativewind | ^4.2.5 | OK — Tailwind for RN |
| tailwindcss | ^3.4.19 | OK |
| zustand | ^5.0.14 | OK — state management |
| moti | ^0.30.0 | OK — animations |
| react-native-reanimated | 4.3.1 | OK |
| react-native-gesture-handler | ~2.31.1 | OK |
| react-native-safe-area-context | ~5.7.0 | OK |
| react-native-screens | 4.25.2 | OK |
| react-native-svg | ^15.15.5 | OK |
| lucide-react-native | ^1.17.0 | OK — icons |
| react-native-markdown-display | ^7.0.2 | OK |
| @shopify/flash-list | ^2.3.1 | OK — fast lists |
| @react-native-async-storage/async-storage | 2.2.0 | OK — local storage |
| react-native-web | ^0.21.2 | OK — web support |
| react-dom | ^19.2.7 | OK |
| typescript | ~6.0.3 | OK |
| babel-preset-expo | ^56.0.14 | OK |

**All dependencies are SDK 56 compatible.**

---

## 2. Build Configuration

### babel.config.js
- `babel-preset-expo` with `jsxImportSource: 'nativewind'`
- `nativewind/babel` preset
- `react-native-worklets/plugin` (required by Reanimated 4)
- **Status: OK**

### metro.config.js
- Uses `withNativeWind(config, { input: './global.css' })`
- **Status: OK**

### tailwind.config.js
- Content paths: `./app/**/*.{js,jsx,ts,tsx}` + `./src/**/*.{js,jsx,ts,tsx}`
- Uses `nativewind/preset`
- Custom colors: brand (purple), accent (pink), ink (gray), jade (green)
- Custom fonts: `sans-sc` (NotoSerifSC)
- **Status: OK**

### tsconfig.json
- Strict mode enabled
- Path alias: `@/*` → `./src/*`
- Includes nativewind-env.d.ts
- **Status: OK**

### app.json
- New Architecture enabled
- Plugins: expo-router, expo-sqlite (no SQLCipher), expo-splash-screen
- Typed routes experiment enabled
- `extra.dataSource: "sqlite"` (switch to `"supabase"` when ready)
- Android adaptive icon configured
- iOS bundle identifier: `com.hskvocab.mobile`
- **Status: OK**

---

## 3. File Structure

```
hsk-vocab-mobile/
├── app/                          # expo-router screens
│   ├── _layout.tsx               # Root layout (providers, theme, Stack)
│   ├── auth.tsx                  # Sign in / Sign up
│   ├── vocabulary.tsx            # Search + browse words by level
│   ├── +not-found.tsx            # 404 page
│   ├── (tabs)/                   # Tab navigator
│   │   ├── _layout.tsx           # 4-tab layout (Home, Learn, AI, Me)
│   │   ├── index.tsx             # Dashboard
│   │   ├── learn.tsx             # Practice mode grid (10 modes)
│   │   ├── ai.tsx                # AI Chat (full implementation)
│   │   └── me.tsx                # Profile / Settings
│   └── mode/                     # Practice mode screens
│       ├── flashcard.tsx         # Placeholder
│       ├── listening.tsx         # Placeholder
│       └── timed-quiz.tsx        # Placeholder
├── src/
│   ├── db/                       # Data layer
│   │   ├── types.ts              # DataSource interface (6 repos)
│   │   ├── context.tsx           # React context + useDataSource()
│   │   ├── index.ts              # Factory (sqlite or supabase)
│   │   ├── sqlite/
│   │   │   └── index.ts          # Full SQLite implementation
│   │   └── supabase/
│   │       └── index.ts          # Stub (throws "not implemented")
│   ├── services/
│   │   ├── ai-chat.ts            # OpenAI-compatible API client
│   │   ├── crypto.ts             # SHA-256 password hashing (expo-crypto)
│   │   └── speech.ts             # TTS via expo-speech
│   ├── stores/
│   │   ├── auth.ts               # Zustand auth store
│   │   └── settings.ts           # Zustand settings store (persisted)
│   ├── theme/
│   │   └── tokens.ts             # Color, gradient, radius, spacing tokens
│   ├── types/
│   │   └── index.ts              # Domain types (Word, UserProgress, etc.)
│   └── utils/
│       └── srs.ts                # SM-2 spaced repetition algorithm
├── assets/
│   └── data/
│       ├── hsk_level_1.json      # 123 KB
│       ├── hsk_level_2.json      # 84 KB
│       ├── hsk_level_3.json      # 217 KB
│       ├── hsk_level_4.json      # 440 KB
│       └── hsk_vocabulary_complete.json  # 864 KB
├── docs/
│   └── SUPABASE_MIGRATION.md     # 7-step migration guide
├── .env.example
├── .gitignore
├── babel.config.js
├── global.css
├── metro.config.js
├── nativewind-env.d.ts
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 4. Screen-by-Screen Review

### 4.1 Root Layout (`app/_layout.tsx`)
- Wraps app in `GestureHandlerRootView` → `SafeAreaProvider` → `DataSourceProvider`
- Reads dark mode from settings store + system color scheme
- Splash screen: prevents auto-hide, then hides on mount
- Stack navigator with screens: (tabs), auth, mode/flashcard, mode/listening, mode/timed-quiz
- **Status: OK**

### 4.2 Tab Layout (`app/(tabs)/_layout.tsx`)
- 4 tabs: Home, Learn, AI Tutor, Me
- Lucide icons: Home, BookOpen, Sparkles, User
- Active tint: brand-500 (#a855f7)
- Dark mode aware (tab bar + header colors)
- **Status: OK**

### 4.3 Dashboard (`app/(tabs)/index.tsx`)
- Welcome message with username
- 3 stat cards: Streak, Today's progress, Mastered count
- HSK level cards (1-4) with progress bars → tap navigates to `/vocabulary?level=X`
- Quick practice pills: Flashcards, Listening, Timed Quiz
- Data: counts from `ds.vocab.countByLevel()`, mastered from `ds.progress.countMasteredByLevel()`
- **Status: OK**

### 4.4 Learn (`app/(tabs)/learn.tsx`)
- 2-column grid of 10 practice modes
- Each card: icon, name, description, colored shadow
- Modes: Flashcards, Listening, Timed Quiz, Sequential, Visual, Sentences, Puzzle, Translation, Shadowing, Handwriting
- All navigate to `/mode/{id}` (only 3 have route screens, others will hit 404)
- **Status: OK** (but 7 modes have no screen yet)

### 4.5 AI Chat (`app/(tabs)/ai.tsx`)
- Full-featured chat interface
- Features: session sidebar, new/delete sessions, streaming response, edit & resend, copy, regenerate, TTS word chips, markdown rendering
- Uses: MotiView animations, expo-clipboard, expo-haptics, react-native-markdown-display, AsyncStorage for persistence
- Quick actions: Grammar Help, Study Plan
- Suggestions: "What does 安排 mean?", etc.
- KeyboardAvoidingView for iOS
- **Status: OK** (full implementation)

### 4.6 Me / Profile (`app/(tabs)/me.tsx`)
- Avatar with initial letter
- Daily goal stepper (5-100, step 5)
- Dark mode toggle
- Haptics toggle
- Sign out / Sign in button
- **Status: OK**

### 4.7 Auth (`app/auth.tsx`)
- Sign in / Sign up toggle
- Fields: email, username (signup only), password
- Error display
- Loading spinner on submit
- Navigates to `/` on success
- **Status: OK**

### 4.8 Vocabulary Browser (`app/vocabulary.tsx`)
- Search input with debounce (250ms)
- Level filter pills: All, HSK 1-4
- FlashList for performance
- Tap word → TTS speaks it
- Back button navigation
- **Status: OK**

### 4.9 Practice Modes (placeholders)
- `mode/flashcard.tsx` — "Coming soon"
- `mode/listening.tsx` — "Coming soon"
- `mode/timed-quiz.tsx` — "Coming soon"
- **Status: PLACEHOLDER** (need porting from web app)

### 4.10 404 Page (`app/+not-found.tsx`)
- "404" heading, "Go home" button
- **Status: OK**

---

## 5. Data Layer Review

### 5.1 DataSource Interface (`src/db/types.ts`)
6 repository interfaces:
| Repository | Methods |
|---|---|
| VocabRepository | init, getWordsByLevel, getWordById, searchWords, countByLevel |
| ProgressRepository | getForUser, getDueWords, upsert, countMasteredByLevel |
| SessionRepository | record, recent, aggregateDaily |
| ProfileRepository | get, upsert |
| AuthRepository | restore, signUp, signIn, signOut, currentUser, onChange |
| ChatRepository | listSessions, getSession, saveSession, deleteSession |

**Status: OK** — clean abstraction, easy to swap implementations.

### 5.2 SQLite Implementation (`src/db/sqlite/index.ts`)
- Database: `hsk.db` (expo-sqlite)
- Schema: 4 tables (words, user_profiles, user_progress, study_sessions)
- Indexes: on hsk_level, chinese, user_id, (user_id, next_review), (user_id, date)
- Auth: SHA-256 hash via expo-crypto, session stored in AsyncStorage
- Chat: stored in AsyncStorage (not SQLite)
- Seeding: lazy-loads `hsk_vocabulary_complete.json` on first launch, inserts all words in a transaction
- **Bug found & fixed:** seeder was importing `hsk_vocabulary.json` (doesn't exist) → changed to `hsk_vocabulary_complete.json`
- **Status: OK** (after bug fix)

### 5.3 Supabase Stub (`src/db/supabase/index.ts`)
- All methods throw `"Supabase method X not implemented yet"`
- Lazy-imported so it doesn't bloat the bundle
- **Status: STUB** (ready for implementation)

### 5.4 Factory (`src/db/index.ts`)
- Reads `app.json → extra.dataSource` to pick implementation
- Singleton pattern with cached promise
- Defaults to `sqlite`
- **Status: OK**

### 5.5 Context (`src/db/context.tsx`)
- `DataSourceProvider` initializes the data source on mount
- Shows loading spinner while initializing
- `useDataSource()` hook for screens
- **Status: OK**

---

## 6. Services Review

### 6.1 AI Chat (`src/services/ai-chat.ts`)
- OpenAI-compatible API client
- Config via env vars: `EXPO_PUBLIC_AI_ENDPOINT`, `EXPO_PUBLIC_AI_KEY`, `EXPO_PUBLIC_AI_MODEL`
- Non-streaming fetch (onChunk called once with full content)
- Extracts Chinese characters from response, looks them up in vocab DB
- Returns `{ content, words }` for word chip display
- **Status: OK** (streaming can be added later)

### 6.2 Crypto (`src/services/crypto.ts`)
- SHA-256 hash via expo-crypto
- Fixed salt: `hsk-vocab-mobile-v1`
- `hashPassword()` and `verifyPassword()`
- **Status: OK**

### 6.3 Speech (`src/services/speech.ts`)
- Uses expo-speech
- Stops previous utterance before speaking new one
- Configurable rate, pitch, language (default: zh-CN, 0.8)
- **Status: OK**

---

## 7. Stores Review

### 7.1 Auth Store (`src/stores/auth.ts`)
- Zustand store
- Methods: init, signIn, signUp, signOut, setUser
- Delegates to `DataSource.auth`
- **Status: OK**

### 7.2 Settings Store (`src/stores/settings.ts`)
- Zustand + persist middleware (AsyncStorage)
- Fields: darkMode, themeMode, dailyGoal, speechRate, hapticsEnabled
- **Status: OK**

---

## 8. Theme & Styling

### 8.1 Design Tokens (`src/theme/tokens.ts`)
- Colors: brand (purple 50-700), accent (pink 400-600), ink (gray 50-950), jade (green 400-600)
- Gradients: brand, brandSoft
- Border radius: sm(6) → 3xl(28)
- Spacing: 1(4px) → 10(40px)
- **Status: OK**

### 8.2 NativeWind / Tailwind
- All screens use className with NativeWind
- Dark mode via `dark:` prefix
- Custom colors match tokens.ts
- **Status: OK**

---

## 9. Seed Data

| File | Size | Content |
|---|---|---|
| hsk_level_1.json | 123 KB | HSK 1 words |
| hsk_level_2.json | 84 KB | HSK 2 words |
| hsk_level_3.json | 217 KB | HSK 3 words |
| hsk_level_4.json | 440 KB | HSK 4 words |
| hsk_vocabulary_complete.json | 864 KB | All levels combined |

**Status: OK** — seeder correctly imports `hsk_vocabulary_complete.json` (fixed from `hsk_vocabulary.json`).

---

## 10. Issues Found

| # | Severity | File | Issue | Fix |
|---|---|---|---|---|
| 1 | **HIGH** | `src/db/sqlite/index.ts:403` | Seeder imported `hsk_vocabulary.json` which doesn't exist | **Fixed** → changed to `hsk_vocabulary_complete.json` |
| 2 | MEDIUM | `app/(tabs)/learn.tsx` | 7 of 10 modes navigate to routes that don't exist (no screen files) → 404 | Need to add placeholder screens or guard navigation |
| 3 | LOW | `src/services/crypto.ts` | Fixed salt (`hsk-vocab-mobile-v1`) — not cryptographically ideal but acceptable for local-only MVP | Use per-user random salt when migrating to Supabase |
| 4 | LOW | `src/theme/tokens.ts` | Font config references `NotoSerifSC` but no `expo-font` loading code exists | Either add font loading or remove the fontFamily config |
| 5 | INFO | `app/(tabs)/ai.tsx` | Chat sessions stored in AsyncStorage directly (not via DataSource.chat) | Works fine for MVP; consider using DataSource.chat for consistency |

---

## 11. Missing Routes (7 modes)

These modes appear in the Learn grid but have no screen file:

| Mode ID | Name | Route |
|---|---|---|
| sequential-quiz | Sequential | `/mode/sequential-quiz` |
| visual | Visual | `/mode/visual` |
| sentence-making | Sentences | `/mode/sentence-making` |
| sentence-puzzle | Puzzle | `/mode/sentence-puzzle` |
| translation | Translation | `/mode/translation` |
| shadowing | Shadowing | `/mode/shadowing` |
| handwriting | Handwriting | `/mode/handwriting` |

**Recommendation:** Add placeholder screens for all 7, then port from web app one by one.

---

## 12. Supabase Migration Readiness

| Aspect | Ready? | Notes |
|---|---|---|
| DataSource interface | YES | Clean 6-repo abstraction |
| Supabase stub | YES | All methods defined (throw "not implemented") |
| Factory switch | YES | `app.json → extra.dataSource` |
| Migration guide | YES | `docs/SUPABASE_MIGRATION.md` (7 steps) |
| Schema compatibility | YES | SQLite tables mirror web app schema |
| Auth flow | PARTIAL | Local password hash → need Supabase Auth |
| Env vars | YES | `.env.example` has AI keys; Supabase keys go in `app.json → extra` |

---

## 13. Summary

- **SDK 56 — fully compatible**, all packages at correct versions
- **Build config — clean**, babel/metro/tailwind/tsconfig all correct
- **6 screens fully implemented**: Dashboard, Learn grid, AI Chat, Me/Profile, Auth, Vocabulary Browser
- **3 practice mode placeholders**: Flashcard, Listening, Timed Quiz
- **7 missing mode screens**: will 404 if tapped
- **1 bug fixed**: seeder JSON import path
- **Data layer — solid**: clean abstraction, SQLite works, Supabase stub ready
- **Design system — consistent**: NativeWind + Tailwind + custom tokens, dark mode throughout
