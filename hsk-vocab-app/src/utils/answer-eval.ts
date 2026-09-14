import { AnswerEvaluation, CharDiffOp } from '@/types/writing'

// Answer comparison for writing practice.
//
// Whitespace and full-width/half-width punctuation differences are treated
// as harmless (the exercise is about producing the right Chinese), but real
// character mistakes are never normalized away.

const CJK_PUNCT_MAP: Record<string, string> = {
  '，': ',', '。': '.', '！': '!', '？': '?', '：': ':', '；': ';',
  '（': '(', '）': ')', '、': ',', '“': '"', '”': '"', '‘': "'", '’': "'",
  '《': '<', '》': '>', '【': '[', '】': ']', '—': '-', '…': '.',
}

const PUNCTUATION = /[.,!?;:'"()<>\[\]\-·、，。！？：；（）《》【】“”‘’…—\s]/g

/** Canonical form: NFC, no whitespace, half-width punctuation, lowercase. */
export function normalizeAnswer(value: string): string {
  if (!value) return ''
  let out = ''
  for (const ch of value.normalize('NFC')) {
    if (ch === '\u3000' || /\s/.test(ch)) continue
    const code = ch.codePointAt(0) || 0
    if (code >= 0xff01 && code <= 0xff5e) {
      out += String.fromCharCode(code - 0xfee0)
      continue
    }
    out += CJK_PUNCT_MAP[ch] ?? ch
  }
  return out.toLowerCase()
}

function stripPunctuation(value: string): string {
  return value.replace(PUNCTUATION, '')
}

function toChars(value: string): string[] {
  return Array.from(value)
}

/** Longest-common-subsequence diff over the normalized character arrays. */
function buildDiff(expected: string[], actual: string[]): CharDiffOp[] {
  const n = expected.length
  const m = actual.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = expected[i] === actual[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const raw: CharDiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (expected[i] === actual[j]) {
      raw.push({ kind: 'same', expectedChar: expected[i], actualChar: actual[j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ kind: 'missing', expectedChar: expected[i], actualChar: null })
      i++
    } else {
      raw.push({ kind: 'extra', expectedChar: null, actualChar: actual[j] })
      j++
    }
  }
  while (i < n) {
    raw.push({ kind: 'missing', expectedChar: expected[i], actualChar: null })
    i++
  }
  while (j < m) {
    raw.push({ kind: 'extra', expectedChar: null, actualChar: actual[j] })
    j++
  }

  // Pair up adjacent missing/extra entries so they render as one substitution.
  const merged: CharDiffOp[] = []
  for (let k = 0; k < raw.length; k++) {
    const op = raw[k]
    const next = raw[k + 1]
    if (op.kind === 'missing' && next?.kind === 'extra') {
      merged.push({ kind: 'wrong', expectedChar: op.expectedChar, actualChar: next.actualChar })
      k++
    } else if (op.kind === 'extra' && next?.kind === 'missing') {
      merged.push({ kind: 'wrong', expectedChar: next.expectedChar, actualChar: op.actualChar })
      k++
    } else {
      merged.push(op)
    }
  }
  return merged
}

export interface EvaluateOptions {
  /** Sentence practice tolerates terminal-punctuation differences. */
  allowPunctuationDifference?: boolean
}

export function evaluateAnswer(
  expected: string,
  actual: string,
  options: EvaluateOptions = {},
): AnswerEvaluation {
  const expectedNorm = normalizeAnswer(expected)
  const actualNorm = normalizeAnswer(actual)
  const expectedChars = toChars(expectedNorm)
  const actualChars = toChars(actualNorm)

  const empty: AnswerEvaluation = {
    correct: false,
    accuracy: 0,
    expected,
    actual,
    diff: expectedChars.map((c) => ({ kind: 'missing', expectedChar: c, actualChar: null })),
    correctChars: 0,
    totalChars: expectedChars.length,
  }

  if (actualChars.length === 0) return empty

  const exact = expectedNorm === actualNorm
  const punctuationOnly =
    !exact && stripPunctuation(expectedNorm) === stripPunctuation(actualNorm)

  if (exact || (punctuationOnly && options.allowPunctuationDifference !== false)) {
    return {
      correct: true,
      accuracy: 1,
      expected,
      actual,
      diff: expectedChars.map((c) => ({ kind: 'same', expectedChar: c, actualChar: c })),
      correctChars: expectedChars.length,
      totalChars: expectedChars.length,
    }
  }

  const diff = buildDiff(expectedChars, actualChars)
  const correctChars = diff.filter((d) => d.kind === 'same').length
  const totalChars = Math.max(expectedChars.length, 1)

  return {
    correct: false,
    accuracy: Math.min(1, correctChars / totalChars),
    expected,
    actual,
    diff,
    correctChars,
    totalChars,
  }
}