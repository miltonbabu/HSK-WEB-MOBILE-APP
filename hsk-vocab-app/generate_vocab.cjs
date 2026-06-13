const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'new hsk 4 all words csv .txt');
const OUTPUT_DIR = path.join(__dirname, 'public');
const CE_DICT = require('./ce_dict.cjs');

function lookupEnglish(chinese) {
  if (CE_DICT[chinese]) {
    const val = CE_DICT[chinese];
    if (val.startsWith('(see ') || val.startsWith('(particle')) return '';
    return val;
  }
  const cleaned = chinese.replace(/~$/g, '');
  if (cleaned !== chinese && CE_DICT[cleaned]) {
    const val = CE_DICT[cleaned];
    if (val.startsWith('(see ') || val.startsWith('(particle')) return '';
    return val;
  }
  return '';
}

const POS_MAP = {
  '动': 'verb',
  '名': 'noun',
  '形': 'adjective',
  '副': 'adverb',
  '代': 'pronoun',
  '介': 'preposition',
  '连': 'conjunction',
  '助': 'particle',
  '叹': 'interjection',
  '量': 'measure',
  '数': 'number',
  '前缀': 'prefix',
  '后缀': 'suffix',
};

function normalizePos(rawPos) {
  if (!rawPos || rawPos.trim() === '') return [];

  const cleaned = rawPos
    .replace(/[（(][^)）]*[)）]/g, '')
    .replace(/[、，,]/g, ' ')
    .trim();

  if (cleaned === '') return [];

  const parts = cleaned.split(/\s+/);
  const results = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed && POS_MAP[trimmed]) {
      results.push(POS_MAP[trimmed]);
    }
  }

  return [...new Set(results)];
}

function parseValue(val) {
  const trimmed = val.trim();
  if (trimmed === '' || trimmed === '""' || trimmed === "''") return '';
  return trimmed.replace(/^["']|["']$/g, '');
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);

  return result;
}

function cleanChineseWord(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/\d+$/, '');
  return cleaned;
}

function main() {
  console.log('Reading CSV file...');
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length === 0) {
    console.error('CSV file is empty!');
    process.exit(1);
  }

  const header = parseCSVLine(lines[0]);
  console.log('CSV Header:', header.join(', '));

  const dataLines = lines.slice(1);

  const levelWords = { 1: [], 2: [], 3: [], 4: [] };
  const allWords = [];
  let globalId = 1;

  for (const line of dataLines) {
    const fields = parseCSVLine(line);
    if (fields.length < 4) continue;

    const seqNo = parseInt(fields[0], 10);
    const level = parseInt(fields[1], 10);
    const rawChinese = parseValue(fields[2]);
    const pinyin = parseValue(fields[3]);
    const rawPos = fields.length >= 5 ? parseValue(fields[4]) : '';

    if (isNaN(level) || level < 1 || level > 4) continue;
    if (!rawChinese) continue;

    const chinese = cleanChineseWord(rawChinese);
    const pos = normalizePos(rawPos);
    const english = lookupEnglish(chinese);

    const word = {
      id: globalId++,
      hsk_level: level,
      chinese: chinese,
      pinyin: pinyin,
      english: english,
      pos: pos,
      pos_raw: rawPos || '',
    };

    levelWords[level].push(word);
    allWords.push(word);
  }

  console.log('\n=== Word Counts ===');
  console.log(`HSK 1: ${levelWords[1].length} words`);
  console.log(`HSK 2: ${levelWords[2].length} words`);
  console.log(`HSK 3: ${levelWords[3].length} words`);
  console.log(`HSK 4: ${levelWords[4].length} words`);
  console.log(`TOTAL: ${allWords.length} words`);

  for (let level = 1; level <= 4; level++) {
    const filename = `hsk_level_${level}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify({ words: levelWords[level] }, null, 2));
    console.log(`\nWrote ${filepath} (${levelWords[level].length} words)`);
  }

  const combinedPath = path.join(OUTPUT_DIR, 'hsk_vocabulary_complete.json');
  fs.writeFileSync(combinedPath, JSON.stringify({ words: allWords }, null, 2));
  console.log(`\nWrote ${combinedPath} (${allWords.length} words)`);

  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    const distAllPath = path.join(distDir, 'hsk_vocabulary_complete.json');
    fs.writeFileSync(distAllPath, JSON.stringify({ words: allWords }, null, 2));
    console.log(`Wrote ${distAllPath}`);
  }

  const expected = { 1: 300, 2: 200, 3: 500, 4: 1000 };
  let allValid = true;
  for (let level = 1; level <= 4; level++) {
    if (levelWords[level].length !== expected[level]) {
      console.error(`WARNING: HSK ${level} has ${levelWords[level].length} words, expected ${expected[level]}!`);
      allValid = false;
    }
  }
  if (allValid) {
    console.log('\nAll word counts match expected values!');
  }

  const stats = {};
  for (const w of allWords) {
    for (const p of w.pos) {
      stats[p] = (stats[p] || 0) + 1;
    }
  }
  console.log('\n=== POS Distribution ===');
  Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([pos, count]) => {
    console.log(`  ${pos}: ${count}`);
  });

  console.log('\nDone!');
}

main();