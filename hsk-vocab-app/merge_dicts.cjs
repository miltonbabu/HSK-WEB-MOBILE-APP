const fs = require('fs');
const path = require('path');

const cePath = path.join(__dirname, 'ce_dict.cjs');
const suppPath = path.join(__dirname, 'supplement_dict.cjs');
const vocabPath = path.join(__dirname, 'public', 'hsk_vocabulary_complete.json');

// Clear require cache
delete require.cache[require.resolve(cePath)];

const CE_DICT = require(cePath);
const supplement = require(suppPath);
const data = JSON.parse(fs.readFileSync(vocabPath, 'utf-8'));

// Merge all supplement entries into CE_DICT
const merged = { ...CE_DICT };
let added = 0;

for (const [key, val] of Object.entries(supplement)) {
  const existing = CE_DICT[key];
  if (!existing || existing.startsWith('(see ') || existing.startsWith('(particle')) {
    merged[key] = val;
    added++;
  }
}

// Count coverage
const allWords = data.words;
const withEn = allWords.filter(w => {
  const en = merged[w.chinese];
  return en && !en.startsWith('(see ') && !en.startsWith('(particle');
});
const withoutEn = allWords.filter(w => {
  const en = merged[w.chinese];
  return !en || en.startsWith('(see ') || en.startsWith('(particle');
});

console.log(`Added ${added} new translations`);
console.log(`Coverage: ${withEn.length}/${allWords.length} (${Math.round(withEn.length/allWords.length*100)}%)`);
console.log(`Still missing: ${withoutEn.length}`);

if (withoutEn.length > 0) {
  const uniqueMissing = new Set();
  withoutEn.forEach(w => uniqueMissing.add(w.chinese));
  console.log(`\nUnique missing words (${uniqueMissing.size}):`);
  const missingList = [...uniqueMissing].sort();
  missingList.forEach(w => {
    const sample = withoutEn.find(x => x.chinese === w);
    console.log(`  '${w}': '', // ${sample.pinyin}`);
  });
}

// Write merged dictionary
let output = fs.readFileSync(cePath, 'utf-8');
// Find the closing brace of the dict object
const closingBrace = output.lastIndexOf('};');
if (closingBrace === -1) {
  console.error('Could not find closing brace in ce_dict.cjs');
  process.exit(1);
}

// Add new entries before closing brace
const newEntriesStr = Object.entries(merged)
  .filter(([key]) => !CE_DICT[key] || CE_DICT[key].startsWith('(see') || CE_DICT[key].startsWith('(particle'))
  .map(([key, val]) => `  '${key}': '${val.replace(/'/g, "\\'")}',`)
  .join('\n');

if (newEntriesStr) {
  output = output.slice(0, closingBrace) + '\n  // === Added via merge_dicts.cjs ===\n' + newEntriesStr + '\n' + output.slice(closingBrace);
  fs.writeFileSync(cePath, output);
  console.log(`\nUpdated ce_dict.cjs with ${added} new entries`);
}