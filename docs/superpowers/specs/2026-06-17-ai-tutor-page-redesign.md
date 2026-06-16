# AI Tutor Page Redesign — Design Spec

**Date:** 2026-06-17
**Status:** Approved (user said "do it all")

## Goal

Redesign the AI tutor page (`/ai`) into a DeepSeek/ChatGPT-style interface with:

1. **3 modes** — Free Chat, Conversation (scenario-based roleplay), Grammar (pattern-focused lessons)
2. **Personalized AI** — AI sees user's HSK level, learning reason, daily goal, streak, total words learned, weak words, mastery distribution
3. **Inline learning actions** — When AI mentions a word, show a clickable card with "Open in Vocabulary", "Start Flashcard", "Add to Smart Review", "Listen"
4. **Mobile fix** — Sidebar slideable drawer; bottom nav hidden when input is focused; keyboard-safe
5. **New visual design** — Cleaner, ChatGPT-inspired, brand-accented

## Architecture

Single route `/ai` → `AIChat` component. Mode is selected via a horizontal pill row at the top of the chat area. Each mode has its own system prompt + optional context card (scenario or grammar pattern).

### Layout (desktop)

```
┌──────────────┬────────────────────────────────────────────────────┐
│ Sidebar      │ Top bar:  [≡] AI Tutor  | [Chat][Conv][Grammar]    │
│ (256px)      ├────────────────────────────────────────────────────┤
│              │ Context card (only in Conversation/Grammar)        │
│ + New Chat   ├────────────────────────────────────────────────────┤
│              │                                                    │
│ Recent       │  Messages (scrollable)                             │
│ • …          │                                                    │
│              │                                                    │
│              ├────────────────────────────────────────────────────┤
│ [collapse]   │  Input bar + send                                  │
└──────────────┴────────────────────────────────────────────────────┘
```

### Layout (mobile)

- Sidebar: full-screen drawer with backdrop
- Top bar: hamburger + title + mode button (opens bottom sheet)
- Bottom nav (Layout): **hidden** while AI input is focused
- Messages and input are full-width
- Input bar always at the bottom, uses `dvh` for proper keyboard handling

## Modes

### Chat (default)
- General tutor
- System prompt: current `SYSTEM_PROMPT` (with personalized additions)
- No context card
- Empty state: quick action chips + suggestion chips

### Conversation
- User picks a scenario (10 curated scenarios)
- Context card shows: scenario title, location, AI character role, starter line
- System prompt: "You are a [role] in a [scenario]. Stay in character. Be natural. Gently correct mistakes by rephrasing, not interrupting flow. Keep replies short (1-3 sentences). Use vocabulary appropriate to the user's HSK level."
- AI opens with the scenario's starter line

### Grammar
- User picks a pattern from existing `GRAMMAR_PATTERNS` (15 patterns)
- Context card shows: pattern name, structure, English meaning
- System prompt: "Focus on teaching the [pattern] grammar pattern. Use the reference examples. Create practice sentences. Use markdown tables for comparisons. Reference the user's known words where possible."

## Personalization

`buildUserProgressContext(userId)` returns a string with:

- HSK level + learning reason + daily goal (from localStorage onboarding or user profile)
- Current streak (from `user.streak_count`)
- Total words learned
- Top 5 weak words (mastery < 3)
- Mastery distribution (counts at each level 0-5)

Injected into the system prompt after the vocab context. Used to:
- Tailor example difficulty
- Reference user's weak words for targeted practice
- Acknowledge streak / progress
- Skip content the user already knows

## Inline learning actions

`WordActionCard` is rendered below an AI message when the AI's response mentions a vocabulary word (detected by scanning the response text against the local Word database). Each card shows:

- Chinese character
- Pinyin
- English meaning
- HSK level chip
- Action buttons: 🔊 Speak · 📖 Open in Vocabulary · 🎴 Flashcard · 🧠 Smart Review

Deep links:
- `/vocabulary?word={chinese}` — opens vocabulary list filtered to that word
- `/learn?word={chinese}` — starts flashcard with that word
- `/mode/smart-review` — opens smart review (the word will be included in queue)

## Data model changes

```ts
// ai-chat.ts
export type AIMode = 'chat' | 'conversation' | 'grammar'

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  userId: string
  mode: AIMode            // NEW
  contextId?: string      // NEW: scenario id or pattern id
  contextTitle?: string   // NEW: for display
}
```

Backwards compatible: existing sessions in localStorage without `mode` default to `'chat'`.

## Components (new)

- `src/data/aiModes.ts` — mode definitions, scenarios list
- `src/stores/aiInputStore.ts` — `inputFocused: boolean` global
- `src/components/ai/WordActionCard.tsx`
- `src/components/ai/MessageBubble.tsx`
- `src/components/ai/ContextCard.tsx`
- `src/components/ai/AIModeTabs.tsx`
- `src/components/ai/ChatSidebar.tsx`
- `src/components/ai/InputBar.tsx`
- `src/components/ai/EmptyState.tsx`

## Files to modify

- `src/pages/AIChat.tsx` — full rewrite
- `src/services/ai-chat.ts` — add `buildUserProgressContext`, scenario/grammar prompts, post-process response to extract words
- `src/components/Layout.tsx` — hide bottom nav on `/ai` when input focused

## Mobile bug fix (input focus)

Problem: when tapping the AI input, the mobile bottom nav stays visible and covers part of the keyboard / input.

Solution:
1. New `aiInputStore` (Zustand) with `inputFocused: boolean`
2. `InputBar` calls `setInputFocused(true)` on focus, `false` on blur
3. `Layout` reads the store and conditionally renders the bottom nav

## Empty state per mode

- **Chat**: existing quick actions (Grammar / Study Plan / Vocab Table / Flow Chart) + suggestion chips
- **Conversation**: 2-column grid of scenario cards with emoji + title + description
- **Grammar**: 2-column grid of pattern cards with Chinese name + English name + HSK level chip

## Out of scope (YAGNI)

- Voice input
- Image upload
- Multiple model selector
- Theme per mode
- Conversation history sync to server
- New session tagging beyond `mode` + `contextId`
