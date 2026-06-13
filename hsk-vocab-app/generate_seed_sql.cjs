const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const completeData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'hsk_vocabulary_complete.json'), 'utf-8'));

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

function generateUUID(seed) {
  return crypto.createHash('md5').update(String(seed)).digest('hex')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

function generateInserts(words, tableName) {
  const rows = words.map(w => {
    const posStr = w.pos.length > 0 ? `'{${w.pos.map(p => `"${escapeSql(p)}"`).join(',')}}'` : "'{}'";
    const posRaw = escapeSql(w.pos_raw || '');
    return `  ('${generateUUID(w.id)}', ${w.hsk_level}, '${escapeSql(w.chinese)}', '${escapeSql(w.pinyin)}', '', ${posStr}, '${posRaw}')`;
  });
  return `INSERT INTO ${tableName} (id, hsk_level, chinese, pinyin, english, pos, pos_raw) VALUES\n${rows.join(',\n')};`;
}

const allWords = completeData.words;

const level1 = allWords.filter(w => w.hsk_level === 1);
const level2 = allWords.filter(w => w.hsk_level === 2);
const level3 = allWords.filter(w => w.hsk_level === 3);
const level4 = allWords.filter(w => w.hsk_level === 4);

let seedSql = `-- HSK Vocabulary Seed Data\n`;
seedSql += `-- HSK Level 1 (${level1.length} words)\n\n`;
seedSql += generateInserts(level1, 'words') + '\n\n';
seedSql += `-- HSK Level 2 (${level2.length} words)\n\n`;
seedSql += generateInserts(level2, 'words') + '\n\n';
seedSql += `-- HSK Level 3 (${level3.length} words)\n\n`;
seedSql += generateInserts(level3, 'words') + '\n\n';
seedSql += `-- HSK Level 4 (${level4.length} words)\n\n`;
seedSql += generateInserts(level4, 'words') + '\n';

fs.writeFileSync(path.join(__dirname, 'supabase', 'seed.sql'), seedSql);
console.log(`Generated supabase/seed.sql (${level1.length}+${level2.length}+${level3.length}+${level4.length}=${allWords.length} words)`);

let completeSql = `-- HSK Vocabulary Seed Data - Complete (${allWords.length} words)\n\n`;
completeSql += generateInserts(allWords, 'words') + '\n';

fs.writeFileSync(path.join(__dirname, 'supabase', 'seed_complete.sql'), completeSql);
console.log(`Generated supabase/seed_complete.sql (${allWords.length} words)`);