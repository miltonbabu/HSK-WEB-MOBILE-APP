const GUEST_LIMIT = 10

interface UsageData {
  date: string
  messagesSent: number
}

// Per-feature AI usage tracking
interface FeatureUsageData {
  date: string
  sequentialQuiz: number
  translation: number
  sentencePuzzle: number
  [key: string]: number | string // allow dynamic access
}

type AIFeature = 'sequential-quiz' | 'translation' | 'sentence-puzzle'

const FEATURE_STORAGE_KEY_MAP: Record<AIFeature, string> = {
  'sequential-quiz': 'sequentialQuiz',
  'translation': 'translation',
  'sentence-puzzle': 'sentencePuzzle',
}

function getStorageKey(userId: string): string {
  return `hsk-usage-${userId}`
}

function getFeatureStorageKey(userId: string): string {
  return `hsk-feature-usage-${userId}`
}

function getToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function loadUsage(userId: string): UsageData {
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return { date: getToday(), messagesSent: 0 }
    const data = JSON.parse(raw) as UsageData
    if (data.date !== getToday()) return { date: getToday(), messagesSent: 0 }
    return data
  } catch {
    return { date: getToday(), messagesSent: 0 }
  }
}

function saveUsage(userId: string, usage: UsageData): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(usage))
  } catch {
    // ignore
  }
}

function loadFeatureUsage(userId: string): FeatureUsageData {
  try {
    const raw = localStorage.getItem(getFeatureStorageKey(userId))
    if (!raw) return { date: getToday(), sequentialQuiz: 0, translation: 0, sentencePuzzle: 0 }
    const data = JSON.parse(raw) as FeatureUsageData
    if (data.date !== getToday()) return { date: getToday(), sequentialQuiz: 0, translation: 0, sentencePuzzle: 0 }
    return data
  } catch {
    return { date: getToday(), sequentialQuiz: 0, translation: 0, sentencePuzzle: 0 }
  }
}

function saveFeatureUsage(userId: string, usage: FeatureUsageData): void {
  try {
    localStorage.setItem(getFeatureStorageKey(userId), JSON.stringify(usage))
  } catch {
    // ignore
  }
}

export const usageService = {
  getDailyLimit(isGuest: boolean): number {
    return isGuest ? GUEST_LIMIT : Infinity
  },

  getMessagesUsed(userId: string): number {
    const usage = loadUsage(userId)
    return usage.messagesSent
  },

  getMessagesRemaining(userId: string, isGuest: boolean): number {
    if (!isGuest) return Infinity
    const used = loadUsage(userId).messagesSent
    return Math.max(0, GUEST_LIMIT - used)
  },

  canSendMessage(userId: string, isGuest: boolean): boolean {
    if (!isGuest) return true
    return loadUsage(userId).messagesSent < GUEST_LIMIT
  },

  recordMessage(userId: string): void {
    const usage = loadUsage(userId)
    usage.messagesSent += 1
    saveUsage(userId, usage)
  },

  // ── Per-feature AI usage ──
  getFeatureRemaining(userId: string, feature: AIFeature, isGuest: boolean): number {
    if (!isGuest) return Infinity
    const usage = loadFeatureUsage(userId)
    const key = FEATURE_STORAGE_KEY_MAP[feature]
    return Math.max(0, GUEST_LIMIT - (usage[key] as number))
  },

  canUseFeature(userId: string, feature: AIFeature, isGuest: boolean): boolean {
    if (!isGuest) return true
    return this.getFeatureRemaining(userId, feature, isGuest) > 0
  },

  recordFeatureUse(userId: string, feature: AIFeature): void {
    const usage = loadFeatureUsage(userId)
    const key = FEATURE_STORAGE_KEY_MAP[feature]
    usage[key] = (usage[key] as number) + 1
    saveFeatureUsage(userId, usage)
  },

  getFeatureCounts(userId: string): { sequentialQuiz: number; translation: number; sentencePuzzle: number } {
    const usage = loadFeatureUsage(userId)
    return {
      sequentialQuiz: usage.sequentialQuiz,
      translation: usage.translation,
      sentencePuzzle: usage.sentencePuzzle,
    }
  },

  getLimit(): number {
    return GUEST_LIMIT
  },
}
