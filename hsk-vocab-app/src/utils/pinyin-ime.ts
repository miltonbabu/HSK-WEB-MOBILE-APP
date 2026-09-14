// Pinyin normalization + syllable segmentation for the writing-practice IME.
//
// Tone-marked pinyin from the vocabulary table (e.g. "xuéxí", "nǚ'ér") is
// normalized to a toneless ASCII form ("xuexi", "nver") so keyboard input
// matches regardless of the tones a word happens to carry. The syllable
// inventory below is standard Mandarin phonotactics — phonetic data, not a
// word→character mapping — so candidate generation stays fully data-driven
// from the vocabulary itself.

const TONE_MARKS: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v',
  ń: 'n', ň: 'n', ǹ: 'n', ḿ: 'm',
}

const SYLLABLE_LIST = [
  'a', 'ai', 'an', 'ang', 'ao',
  'ba', 'bai', 'ban', 'bang', 'bao', 'bei', 'ben', 'beng', 'bi', 'bian', 'biao', 'bie', 'bin', 'bing', 'bo', 'bu',
  'ca', 'cai', 'can', 'cang', 'cao', 'ce', 'cen', 'ceng', 'cha', 'chai', 'chan', 'chang', 'chao', 'che', 'chen', 'cheng', 'chi', 'chong', 'chou', 'chu', 'chua', 'chuai', 'chuan', 'chuang', 'chui', 'chun', 'chuo', 'ci', 'cong', 'cou', 'cu', 'cuan', 'cui', 'cun', 'cuo',
  'da', 'dai', 'dan', 'dang', 'dao', 'de', 'dei', 'den', 'deng', 'di', 'dian', 'diao', 'die', 'ding', 'diu', 'dong', 'dou', 'du', 'duan', 'dui', 'dun', 'duo',
  'e', 'ei', 'en', 'eng', 'er',
  'fa', 'fan', 'fang', 'fei', 'fen', 'feng', 'fo', 'fou', 'fu',
  'ga', 'gai', 'gan', 'gang', 'gao', 'ge', 'gei', 'gen', 'geng', 'gong', 'gou', 'gu', 'gua', 'guai', 'guan', 'guang', 'gui', 'gun', 'guo',
  'ha', 'hai', 'han', 'hang', 'hao', 'he', 'hei', 'hen', 'heng', 'hong', 'hou', 'hu', 'hua', 'huai', 'huan', 'huang', 'hui', 'hun', 'huo',
  'ji', 'jia', 'jian', 'jiang', 'jiao', 'jie', 'jin', 'jing', 'jiong', 'jiu', 'ju', 'juan', 'jue', 'jun',
  'ka', 'kai', 'kan', 'kang', 'kao', 'ke', 'kei', 'ken', 'keng', 'kong', 'kou', 'ku', 'kua', 'kuai', 'kuan', 'kuang', 'kui', 'kun', 'kuo',
  'la', 'lai', 'lan', 'lang', 'lao', 'le', 'lei', 'leng', 'li', 'lia', 'lian', 'liang', 'liao', 'lie', 'lin', 'ling', 'liu', 'lo', 'long', 'lou', 'lu', 'lv', 'luan', 'lve', 'lun', 'luo',
  'm', 'ma', 'mai', 'man', 'mang', 'mao', 'me', 'mei', 'men', 'meng', 'mi', 'mian', 'miao', 'mie', 'min', 'ming', 'miu', 'mo', 'mou', 'mu',
  'n', 'na', 'nai', 'nan', 'nang', 'nao', 'ne', 'nei', 'nen', 'neng', 'ng', 'ni', 'nian', 'niang', 'niao', 'nie', 'nin', 'ning', 'niu', 'nong', 'nou', 'nu', 'nv', 'nuan', 'nve', 'nuo',
  'o', 'ou',
  'pa', 'pai', 'pan', 'pang', 'pao', 'pei', 'pen', 'peng', 'pi', 'pian', 'piao', 'pie', 'pin', 'ping', 'po', 'pou', 'pu',
  'qi', 'qia', 'qian', 'qiang', 'qiao', 'qie', 'qin', 'qing', 'qiong', 'qiu', 'qu', 'quan', 'que', 'qun',
  'ran', 'rang', 'rao', 're', 'ren', 'reng', 'ri', 'rong', 'rou', 'ru', 'rua', 'ruan', 'rui', 'run', 'ruo',
  'sa', 'sai', 'san', 'sang', 'sao', 'se', 'sen', 'seng', 'sha', 'shai', 'shan', 'shang', 'shao', 'she', 'shei', 'shen', 'sheng', 'shi', 'shou', 'shu', 'shua', 'shuai', 'shuan', 'shuang', 'shui', 'shun', 'shuo', 'si', 'song', 'sou', 'su', 'suan', 'sui', 'sun', 'suo',
  'ta', 'tai', 'tan', 'tang', 'tao', 'te', 'teng', 'ti', 'tian', 'tiao', 'tie', 'ting', 'tong', 'tou', 'tu', 'tuan', 'tui', 'tun', 'tuo',
  'wa', 'wai', 'wan', 'wang', 'wei', 'wen', 'weng', 'wo', 'wu',
  'xi', 'xia', 'xian', 'xiang', 'xiao', 'xie', 'xin', 'xing', 'xiong', 'xiu', 'xu', 'xuan', 'xue', 'xun',
  'ya', 'yan', 'yang', 'yao', 'ye', 'yi', 'yin', 'ying', 'yo', 'yong', 'you', 'yu', 'yuan', 'yue', 'yun',
  'za', 'zai', 'zan', 'zang', 'zao', 'ze', 'zei', 'zen', 'zeng', 'zha', 'zhai', 'zhan', 'zhang', 'zhao', 'zhe', 'zhei', 'zhen', 'zheng', 'zhi', 'zhong', 'zhou', 'zhu', 'zhua', 'zhuai', 'zhuan', 'zhuang', 'zhui', 'zhun', 'zhuo', 'zi', 'zong', 'zou', 'zu', 'zuan', 'zui', 'zun', 'zuo',
]

const SYLLABLES = new Set(SYLLABLE_LIST)
const MAX_SYLLABLE_LENGTH = 6

/** Strip tone marks, spaces, apostrophes and digits → lowercase ASCII pinyin. */
export function stripTones(pinyin: string): string {
  if (!pinyin) return ''
  let out = ''
  for (const ch of pinyin.toLowerCase()) {
    const mapped = TONE_MARKS[ch]
    if (mapped) {
      out += mapped
    } else if (ch >= 'a' && ch <= 'z') {
      out += ch
    }
  }
  return out
}

export function isPinyinSyllable(value: string): boolean {
  return SYLLABLES.has(value)
}

/**
 * Split a toneless pinyin string into syllables using backtracking
 * segmentation. Returns null when the string cannot be fully split.
 *
 * "xuexi" → ["xue", "xi"], "nver" → ["nv", "er"],
 * "woxihuanzhongguo" → ["wo", "xi", "huan", "zhong", "guo"]
 */
export function segmentPinyin(pinyin: string): string[] | null {
  const s = stripTones(pinyin)
  if (!s) return []

  const memo = new Map<number, string[] | null>()

  const solve = (pos: number): string[] | null => {
    if (pos === s.length) return []
    const cached = memo.get(pos)
    if (cached !== undefined) return cached

    for (let len = Math.min(MAX_SYLLABLE_LENGTH, s.length - pos); len >= 1; len--) {
      const candidate = s.slice(pos, pos + len)
      if (SYLLABLES.has(candidate)) {
        const rest = solve(pos + len)
        if (rest) {
          const result = [candidate, ...rest]
          memo.set(pos, result)
          return result
        }
      }
    }
    memo.set(pos, null)
    return null
  }

  return solve(0)
}

/** True when the string contains at least one CJK ideograph. */
export function hasChineseText(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value)
}

export function countChineseChars(value: string): number {
  const matches = value.match(/[\u4e00-\u9fff]/g)
  return matches ? matches.length : 0
}