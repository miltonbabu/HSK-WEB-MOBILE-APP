import { MasteryLevel, UserProgress } from '@/types'

interface SM2Result {
  mastery_level: MasteryLevel
  easiness_factor: number
  interval: number
  next_review: Date
}

export function calculateSM2(
  quality: 0 | 1 | 2 | 3 | 4 | 5,
  previousEA: number = 2.5,
  previousInterval: number = 1,
  previousRepetitions: number = 0
): SM2Result {
  let easiness_factor = previousEA + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  easiness_factor = Math.max(1.3, easiness_factor)

  let interval: number
  let repetitions: number

  if (quality < 3) {
    repetitions = 0
    interval = 1
  } else {
    repetitions = previousRepetitions + 1
    if (repetitions === 1) {
      interval = 1
    } else if (repetitions === 2) {
      interval = 6
    } else {
      interval = Math.round(previousInterval * easiness_factor)
    }
  }

  const next_review = new Date()
  next_review.setDate(next_review.getDate() + interval)

  let mastery_level: MasteryLevel
  if (quality < 2) mastery_level = 0
  else if (quality < 3) mastery_level = 1
  else if (quality < 4) mastery_level = 2
  else if (quality === 4) mastery_level = 3
  else mastery_level = 5

  return {
    mastery_level,
    easiness_factor,
    interval,
    next_review,
  }
}

export function getNextReviewDate(interval: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + interval)
  return date
}

export function isDueForReview(progress: UserProgress): boolean {
  return new Date(progress.next_review) <= new Date()
}

export function getMasteryColor(level: MasteryLevel): string {
  const colors: Record<MasteryLevel, string> = {
    0: 'bg-gray-200',
    1: 'bg-red-400',
    2: 'bg-orange-400',
    3: 'bg-yellow-400',
    4: 'bg-green-400',
    5: 'bg-primary-500',
  }
  return colors[level]
}

export function getMasteryLabel(level: MasteryLevel): string {
  const labels: Record<MasteryLevel, string> = {
    0: 'New',
    1: 'Learning',
    2: 'Reviewing',
    3: 'Familiar',
    4: 'Mastered',
    5: 'Expert',
  }
  return labels[level]
}