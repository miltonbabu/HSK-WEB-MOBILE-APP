export interface AchievementStats {
  totalWordsLearned: number  // words with mastery >= 3
  currentStreak: number
  totalSessions: number
  perfectQuizzes: number  // sessions with 100% accuracy
  levelsStudied: number[]  // which HSK levels have been studied
  totalStudyTime: number  // in seconds
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string  // emoji
  condition: (stats: AchievementStats) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-steps', name: 'First Steps', description: 'Complete your first study session', icon: '🎯', condition: (s) => s.totalSessions >= 1 },
  { id: 'word-collector-10', name: 'Word Collector', description: 'Learn 10 words', icon: '📚', condition: (s) => s.totalWordsLearned >= 10 },
  { id: 'word-collector-50', name: 'Bookworm', description: 'Learn 50 words', icon: '📖', condition: (s) => s.totalWordsLearned >= 50 },
  { id: 'word-collector-100', name: 'Scholar', description: 'Learn 100 words', icon: '🎓', condition: (s) => s.totalWordsLearned >= 100 },
  { id: 'word-collector-500', name: 'Master Scholar', description: 'Learn 500 words', icon: '🏛️', condition: (s) => s.totalWordsLearned >= 500 },
  { id: 'word-collector-1000', name: 'Grand Master', description: 'Learn 1000 words', icon: '👑', condition: (s) => s.totalWordsLearned >= 1000 },
  { id: 'streak-3', name: 'Getting Started', description: '3-day study streak', icon: '🔥', condition: (s) => s.currentStreak >= 3 },
  { id: 'streak-7', name: 'Week Warrior', description: '7-day study streak', icon: '⚡', condition: (s) => s.currentStreak >= 7 },
  { id: 'streak-14', name: 'Fortnight Fighter', description: '14-day study streak', icon: '💪', condition: (s) => s.currentStreak >= 14 },
  { id: 'streak-30', name: 'Monthly Master', description: '30-day study streak', icon: '🌟', condition: (s) => s.currentStreak >= 30 },
  { id: 'quiz-champion', name: 'Quiz Champion', description: 'Score 100% on a quiz', icon: '🏆', condition: (s) => s.perfectQuizzes >= 1 },
  { id: 'polyglot', name: 'Polyglot', description: 'Study words from all 4 HSK levels', icon: '🌍', condition: (s) => s.levelsStudied.length >= 4 },
  { id: 'dedicated', name: 'Dedicated Learner', description: 'Study for 1 hour total', icon: '⏰', condition: (s) => s.totalStudyTime >= 3600 },
]

const STORAGE_KEY = 'hsk-achievements'

export function checkAchievements(stats: AchievementStats): string[] {
  return ACHIEVEMENTS.filter((a) => a.condition(stats)).map((a) => a.id)
}

export function getUnlockedAchievements(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveUnlockedAchievements(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function checkAndUnlockAchievements(stats: AchievementStats): Achievement[] {
  const previouslyUnlocked = getUnlockedAchievements()
  const currentlyMet = checkAchievements(stats)
  const newIds = currentlyMet.filter((id) => !previouslyUnlocked.includes(id))

  if (newIds.length > 0) {
    saveUnlockedAchievements([...previouslyUnlocked, ...newIds])
  }

  return ACHIEVEMENTS.filter((a) => newIds.includes(a.id))
}
