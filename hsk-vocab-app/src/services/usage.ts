// ── AI Usage Tracking ──────────────────────────────────────────────
//
// Guest model:
//   10 uses per AI mode per day. Each mode (chat, conversation, grammar,
//   sequential-quiz, translation, sentence-puzzle) gets its own counter
//   that resets at midnight. After 10 uses in a mode, that mode is
//   blocked until the next day.
//
// Registered model:
//   2 hours (120 min) of total AI usage per day across ALL modes. We
//   approximate "usage time" by measuring the gap between consecutive
//   AI messages (capped at 5 min per gap to avoid counting idle time).
//   After 120 min of accumulated usage, all AI features are blocked
//   until the next day.

const GUEST_MODE_LIMIT = 10
const REGISTERED_DAILY_MINUTES = 120
// Max seconds to count between two consecutive AI messages. Prevents
// idle tab time from inflating the usage counter.
const MAX_GAP_SECONDS = 5 * 60 // 5 minutes

// All trackable AI modes (chat page modes + feature page modes)
type AIChatMode = 'chat' | 'conversation' | 'grammar'
type AIFeatureMode = 'sequential-quiz' | 'translation' | 'sentence-puzzle'
export type AllAIMode = AIChatMode | AIFeatureMode

// ── Per-mode count tracking (guests) ──

interface ModeUsageData {
  date: string
  counts: Record<string, number>
}

function getModeStorageKey(userId: string): string {
  return `hsk-ai-mode-usage-${userId}`
}

function getToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function loadModeUsage(userId: string): ModeUsageData {
  try {
    const raw = localStorage.getItem(getModeStorageKey(userId))
    if (!raw) return { date: getToday(), counts: {} }
    const data = JSON.parse(raw) as ModeUsageData
    if (data.date !== getToday()) return { date: getToday(), counts: {} }
    return data
  } catch {
    return { date: getToday(), counts: {} }
  }
}

function saveModeUsage(userId: string, usage: ModeUsageData): void {
  try {
    localStorage.setItem(getModeStorageKey(userId), JSON.stringify(usage))
  } catch {
    // ignore
  }
}

// ── Time-based tracking (registered users) ──

interface TimeUsageData {
  date: string
  totalSeconds: number
  lastMessageAt: number | null // epoch ms of the last AI message
}

function getTimeStorageKey(userId: string): string {
  return `hsk-ai-time-usage-${userId}`
}

function loadTimeUsage(userId: string): TimeUsageData {
  try {
    const raw = localStorage.getItem(getTimeStorageKey(userId))
    if (!raw) return { date: getToday(), totalSeconds: 0, lastMessageAt: null }
    const data = JSON.parse(raw) as TimeUsageData
    if (data.date !== getToday()) return { date: getToday(), totalSeconds: 0, lastMessageAt: null }
    return data
  } catch {
    return { date: getToday(), totalSeconds: 0, lastMessageAt: null }
  }
}

function saveTimeUsage(userId: string, usage: TimeUsageData): void {
  try {
    localStorage.setItem(getTimeStorageKey(userId), JSON.stringify(usage))
  } catch {
    // ignore
  }
}

// ── Public API ──

export const usageService = {
  // ── Guest: per-mode count ──

  getModeLimit(): number {
    return GUEST_MODE_LIMIT
  },

  getModeRemaining(userId: string, mode: AllAIMode, isGuest: boolean): number {
    if (!isGuest) return Infinity
    const usage = loadModeUsage(userId)
    const used = usage.counts[mode] || 0
    return Math.max(0, GUEST_MODE_LIMIT - used)
  },

  canUseMode(userId: string, mode: AllAIMode, isGuest: boolean): boolean {
    if (!isGuest) return this.canUseTime(userId)
    return this.getModeRemaining(userId, mode, isGuest) > 0
  },

  recordModeUse(userId: string, mode: AllAIMode, isGuest: boolean): void {
    if (isGuest) {
      const usage = loadModeUsage(userId)
      usage.counts[mode] = (usage.counts[mode] || 0) + 1
      saveModeUsage(userId, usage)
    } else {
      // For registered users, track time instead of count
      this.recordTimeUse(userId)
    }
  },

  getModeCounts(userId: string): Record<string, number> {
    return loadModeUsage(userId).counts
  },

  // ── Registered: time-based ──

  getDailyMinutes(): number {
    return REGISTERED_DAILY_MINUTES
  },

  getTimeUsedSeconds(userId: string): number {
    return loadTimeUsage(userId).totalSeconds
  },

  getTimeRemainingMinutes(userId: string): number {
    const usage = loadTimeUsage(userId)
    return Math.max(0, REGISTERED_DAILY_MINUTES - Math.floor(usage.totalSeconds / 60))
  },

  canUseTime(userId: string): boolean {
    const usage = loadTimeUsage(userId)
    return usage.totalSeconds < REGISTERED_DAILY_MINUTES * 60
  },

  recordTimeUse(userId: string): void {
    const usage = loadTimeUsage(userId)
    const now = Date.now()
    if (usage.lastMessageAt) {
      const gapSec = Math.min(MAX_GAP_SECONDS, Math.floor((now - usage.lastMessageAt) / 1000))
      usage.totalSeconds += gapSec
    }
    usage.lastMessageAt = now
    saveTimeUsage(userId, usage)
  },

  // ── Unified helpers ──

  /** Remaining for display: mode count for guests, time for registered */
  getRemainingDisplay(userId: string, mode: AllAIMode, isGuest: boolean): { value: number; unit: 'uses' | 'min' } {
    if (isGuest) {
      return { value: this.getModeRemaining(userId, mode, isGuest), unit: 'uses' }
    }
    return { value: this.getTimeRemainingMinutes(userId), unit: 'min' }
  },

  // ── Legacy compat (used by old code that hasn't been updated yet) ──
  // These delegate to the new per-mode system with mode='chat'.

  getMessagesRemaining(userId: string, isGuest: boolean): number {
    if (isGuest) return this.getModeRemaining(userId, 'chat', isGuest)
    return this.getTimeRemainingMinutes(userId)
  },

  canSendMessage(userId: string, isGuest: boolean): boolean {
    return this.canUseMode(userId, 'chat', isGuest)
  },

  recordMessage(userId: string, isGuest: boolean): void {
    this.recordModeUse(userId, 'chat', isGuest)
  },

  getLimit(): number {
    return GUEST_MODE_LIMIT
  },

  // ── Per-feature AI usage (legacy compat for mode pages) ──
  // These now delegate to the unified per-mode system.

  getFeatureRemaining(userId: string, feature: AIFeatureMode, isGuest: boolean): number {
    if (!isGuest) return this.getTimeRemainingMinutes(userId)
    return this.getModeRemaining(userId, feature, isGuest)
  },

  canUseFeature(userId: string, feature: AIFeatureMode, isGuest: boolean): boolean {
    return this.canUseMode(userId, feature, isGuest)
  },

  recordFeatureUse(userId: string, feature: AIFeatureMode, isGuest: boolean): void {
    this.recordModeUse(userId, feature, isGuest)
  },

  getFeatureCounts(userId: string): { sequentialQuiz: number; translation: number; sentencePuzzle: number } {
    const counts = loadModeUsage(userId).counts
    return {
      sequentialQuiz: counts['sequential-quiz'] || 0,
      translation: counts['translation'] || 0,
      sentencePuzzle: counts['sentence-puzzle'] || 0,
    }
  },
}
