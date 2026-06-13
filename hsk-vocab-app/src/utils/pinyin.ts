export function getToneNumber(pinyin: string): number {
  const toneMarks: Record<string, number> = {
    'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4,
    'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
    'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4,
    'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
    'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4,
    'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4,
  }

  for (const char of pinyin) {
    if (toneMarks[char]) {
      return toneMarks[char]
    }
  }
  return 5
}

export function getToneColor(tone: number): string {
  const colors = {
    1: 'text-tone-1',
    2: 'text-tone-2',
    3: 'text-tone-3',
    4: 'text-tone-4',
    5: 'text-tone-5',
  }
  return colors[tone as keyof typeof colors] || 'text-gray-600'
}

export function formatPinyin(pinyin: string): string {
  return pinyin
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .trim()
}

export function splitPinyinSyllables(pinyin: string): { syllable: string; tone: number }[] {
  const syllables = pinyin.split(' ')
  return syllables.map(syllable => ({
    syllable,
    tone: getToneNumber(syllable),
  }))
}

export function highlightTones(pinyin: string): string {
  const tones: Record<number, { open: string; close: string }> = {
    1: { open: '<span class="text-tone-1 font-semibold">', close: '</span>' },
    2: { open: '<span class="text-tone-2 font-semibold">', close: '</span>' },
    3: { open: '<span class="text-tone-3 font-semibold">', close: '</span>' },
    4: { open: '<span class="text-tone-4 font-semibold">', close: '</span>' },
    5: { open: '<span class="text-tone-5 font-semibold">', close: '</span>' },
  }

  const parts = splitPinyinSyllables(pinyin)
  return parts
    .map(({ syllable, tone }) => `${tones[tone].open}${syllable}${tones[tone].close}`)
    .join(' ')
}