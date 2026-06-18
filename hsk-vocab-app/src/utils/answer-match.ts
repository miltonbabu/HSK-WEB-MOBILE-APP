// ── Fuzzy answer matching for Learn modes ──────────────────────────
//
// Accepts near-correct answers: typos, synonyms, alternative wordings,
// partial answers, and semicolon-separated alternative meanings.
// Used by SequentialQuizMode, ListeningMode, and other text-input modes.

/** Lowercase, trim, collapse spaces, strip punctuation/parenthetical notes. */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    // remove parenthetical content like "(formal)" or "(lit.)"
    .replace(/\([^)]*\)/g, '')
    // remove common punctuation
    .replace(/[.,!?;:'"¿¡。，！？、；：""'']/g, '')
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/** Levenshtein edit distance (case-insensitive, character-level). */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

/** Split a correct answer into all acceptable alternative meanings. */
function getAcceptableAnswers(correctAnswer: string): string[] {
  return correctAnswer
    .split(/[;,/]/)
    .map((s) => normalize(s))
    .filter((s) => s.length > 0)
}

/**
 * Check if the user's answer is correct using fuzzy matching.
 *
 * Rules (any one match → correct):
 * 1. Exact normalized match against any acceptable meaning.
 * 2. Levenshtein distance ≤ 2 against any meaning (handles typos).
 * 3. User answer is a substring of a meaning, or vice versa (partial).
 * 4. All significant words in the user answer appear in a meaning.
 *
 * @param userAnswer   The raw text the user typed.
 * @param correctAnswer The expected answer (may contain ';' for alternatives).
 * @param options       { pinyin?: boolean } — for pinyin, strip all spaces.
 */
export function isAnswerCorrect(
  userAnswer: string,
  correctAnswer: string,
  options: { pinyin?: boolean } = {}
): boolean {
  let user = normalize(userAnswer)
  let acceptables = getAcceptableAnswers(correctAnswer)

  // For pinyin, strip all spaces so "ni hao" == "nihao"
  if (options.pinyin) {
    user = user.replace(/\s+/g, '')
    acceptables = acceptables.map((a) => a.replace(/\s+/g, ''))
  }

  if (!user) return false

  for (const target of acceptables) {
    // 1. Exact match
    if (user === target) return true

    // 2. Levenshtein distance ≤ 2 (typo tolerance)
    //    Only apply for reasonably short strings to avoid false positives.
    if (target.length <= 30 && user.length <= 30) {
      const dist = levenshtein(user, target)
      const threshold = target.length <= 4 ? 1 : 2
      if (dist <= threshold) return true
    }

    // 3. Substring match (partial answer or extra words)
    if (target.length >= 3 && user.length >= 3) {
      if (target.includes(user) || user.includes(target)) return true
    }

    // 4. Word-level containment — every word in user's answer appears in target
    const userWords = user.split(' ').filter((w) => w.length > 1)
    const targetWords = new Set(target.split(' ').filter((w) => w.length > 1))
    if (userWords.length > 0 && userWords.every((w) => targetWords.has(w))) {
      return true
    }
  }

  return false
}
