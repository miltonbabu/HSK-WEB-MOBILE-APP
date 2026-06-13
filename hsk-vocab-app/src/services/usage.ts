const GUEST_LIMIT = 10

interface UsageData {
  date: string
  messagesSent: number
}

function getStorageKey(userId: string): string {
  return `hsk-usage-${userId}`
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

  getLimit(): number {
    return GUEST_LIMIT
  },
}
