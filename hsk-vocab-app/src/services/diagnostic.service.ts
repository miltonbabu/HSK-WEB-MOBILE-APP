import { HSKLevel } from '@/types'
import { ExamResult } from '@/types/exam'
import { Skill, SkillScore } from '@/types/learning'
import { progressService, wordService } from './sqlite-api'

export interface DiagnosticAnalysis {
  overall: number
  skill_scores: SkillScore[]
  weak_words: string[]
  level3_mastery: number | null
  level4_readiness: number | null
}

/**
 * Turn an exam result into a diagnostic report: per-skill scores (from the
 * exam sections + vocabulary mastery), a weak-word list, and level readiness.
 */
export async function analyzeDiagnostic(
  userId: string,
  hskLevel: HSKLevel,
  result: ExamResult,
): Promise<DiagnosticAnalysis> {
  const skillScores: SkillScore[] = []
  const entries = Object.entries(result.sectionResults) as [
    string,
    { correct: number; total: number },
  ][]
  for (const [id, r] of entries) {
    if (r.total === 0) continue
    const skill: Skill = id === 'listening' ? 'listening' : id === 'reading' ? 'reading' : 'writing'
    skillScores.push({ skill, score: Math.round((r.correct / r.total) * 100) })
  }

  const progress = await progressService.getUserProgress(userId)
  const counts = await wordService.getWordCounts()
  const total = counts
    .filter((c) => c.hsk_version === '3.0' && c.hsk_level === hskLevel)
    .reduce((s, c) => s + c.count, 0)
  const levelWords = await wordService.getByLevel(hskLevel, '3.0')
  const masteredIds = new Set(progress.filter((p) => p.mastery_level >= 3).map((p) => p.word_id))
  const masteredCount = levelWords.filter((w) => masteredIds.has(w.id)).length
  const masteryPct = total > 0 ? Math.round((masteredCount / total) * 100) : null
  if (masteryPct !== null) skillScores.push({ skill: 'vocabulary', score: masteryPct })

  const weak = new Set<string>()
  for (const review of result.questionReviews) {
    if (!review.correct) weak.add(review.question.word.chinese)
  }
  for (const w of levelWords) {
    if (!masteredIds.has(w.id) && weak.size < 12) weak.add(w.chinese)
  }
  const weakWords = Array.from(weak).slice(0, 12)

  const overall = skillScores.length
    ? Math.round(skillScores.reduce((s, x) => s + x.score, 0) / skillScores.length)
    : 0

  return {
    overall,
    skill_scores: skillScores,
    weak_words: weakWords,
    level3_mastery: hskLevel === 3 ? masteryPct : null,
    level4_readiness: hskLevel === 4 ? masteryPct : null,
  }
}