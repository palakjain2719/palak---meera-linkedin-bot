// Run the screening + news + drafting pipeline from the terminal, no Telegram needed.
// Usage: GEMINI_API_KEY=... node test-local.js "your note here"

import { screen, newsAngle, draft, verifyBlock } from './lib/pipeline.js';

const note = process.argv.slice(2).join(' ');
if (!note) {
  console.error('Pass a note as an argument.');
  process.exit(1);
}

const screening = await screen(note);
console.log(`\nSCORE ${screening.score}/10 — ${screening.reason}`);
console.log(`ANGLE: ${screening.angle || '(none)'}`);
console.log(`SEARCH: ${screening.searchPhrase || '(none)'}\n`);

if (!screening.passed) {
  console.log('Below threshold. No draft.');
  process.exit(0);
}

const news = await newsAngle(screening.searchPhrase);
console.log('NEWS:', news ? `${news.headline} — ${news.source} ${news.date}` : '(none found)', '\n');

const body = await draft(note, screening, news);
console.log('─'.repeat(50));
console.log(body + (news ? verifyBlock(news) : ''));
console.log('─'.repeat(50));
