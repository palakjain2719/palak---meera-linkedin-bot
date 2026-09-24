import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gemini, parseJson } from './gemini.js';
import { topNewsItem } from './news.js';

const here = dirname(fileURLToPath(import.meta.url));

let cachedVoice = null;
export function voiceSkill() {
  if (cachedVoice) return cachedVoice;
  const candidates = [
    join(process.cwd(), 'voice-skill.txt'),
    join(here, '..', 'voice-skill.txt'),
    join(here, 'voice-skill.txt'),
  ];
  for (const path of candidates) {
    try {
      cachedVoice = readFileSync(path, 'utf8');
      return cachedVoice;
    } catch { /* try the next one */ }
  }
  throw new Error('voice-skill.txt not found - the draft would not be in her voice, so nothing was sent');
}

const SCORE_MODEL = () => process.env.GEMINI_SCORE_MODEL || 'gemini-2.5-flash';
const DRAFT_MODEL = () => process.env.GEMINI_DRAFT_MODEL || 'gemini-2.5-flash';
const THRESHOLD = () => Number(process.env.SCORE_THRESHOLD || 6);

// STEP 1 - screen the note, and if it survives, pull search terms in the same call.
export async function screen(note) {
  const prompt = `You screen raw notes from Meera Pillai, founder of Skinstinct, an Indian skincare brand. She is a former pharmaceutical formulation scientist. She writes LinkedIn posts about formulation chemistry, ingredient behaviour, stability testing, label and marketing claims, regulatory gaps in Indian beauty, and the honest operating reality of running a small skincare brand.

Score this note 0-10 on whether it can become a LinkedIn post that belongs in that body of work.

Score high (7-10) when the note contains at least one of:
- a technical or formulation observation
- a claim, label, or industry convention worth interrogating
- a concrete number, incident, customer interaction, or internal failure
- a link to something currently moving in her field or in the news
- a continuation of a theme she already writes about

Score low (0-4) when the note is:
- a personal logistics item, errand, or reminder ("want a cup of coffee", "call the courier")
- an abandoned half-thought with no claim, subject, or detail in it
- outside her stated expertise, particularly medical or dermatological advice
- so generic it could belong to any founder in any industry

Be strict. A vague note that merely mentions skincare is not a 6.

Note:
"""${note}"""

Return JSON only, this exact shape:
{"score": <0-10 integer>, "reason": "<one plain sentence, max 25 words>", "angle": "<the specific post-worthy claim inside the note, or empty string>", "search_phrase": "<3-6 word news search phrase, or empty string>"}`;

  const out = parseJson(await gemini(SCORE_MODEL(), prompt, { json: true, temperature: 0.2 }));
  return {
    score: Number(out.score) || 0,
    reason: String(out.reason || '').trim(),
    angle: String(out.angle || '').trim(),
    searchPhrase: String(out.search_phrase || '').trim(),
    passed: (Number(out.score) || 0) >= THRESHOLD(),
  };
}

// STEP 2 - find a news angle. Optional by design; a miss never blocks the draft.
export async function newsAngle(searchPhrase) {
  try {
    return await topNewsItem(searchPhrase);
  } catch {
    return null;
  }
}

// STEP 3 - write the post in her voice.
export async function draft(note, screening, news) {
  const newsBlock = news
    ? `A possibly relevant news item from the last 30 days:
HEADLINE: ${news.headline}
SOURCE: ${news.source}
DATE: ${news.date}

If this item is genuinely relevant to the note, use it to make the post timely. If it does not fit naturally, ignore it completely and do not mention it. Never invent a detail about it beyond the headline above - you have only seen the headline, not the article.`
    : 'No news item was found. Write the post without one.';

  const prompt = `You are drafting a LinkedIn post as Meera Pillai. Follow the voice specification below exactly. It is not a style suggestion; it is a constraint.

===== VOICE SPECIFICATION =====
${voiceSkill()}
===== END VOICE SPECIFICATION =====

Meera's raw note:
"""${note}"""

The post-worthy angle inside it: ${screening.angle || '(work it out from the note)'}

${newsBlock}

FORMAT RULES FOR LINKEDIN
- 150-300 words. Never longer.
- The first line must stand alone as the hook, followed by a blank line. It must be a concrete number, a dated scene, or a flat declarative claim - never a question.
- Short paragraphs of 1-3 sentences, separated by blank lines. LinkedIn collapses single newlines.
- Plain text only. No markdown, no bold, no bullet characters, no headers, no emojis, no hashtags, no links in the body.
- No exclamation points anywhere.
- Include the self-implicating Skinstinct moment.
- End on a short flat line, or on a question directed at the industry - not at the reader's feelings.
- If the topic sits near anything Skinstinct sells, state plainly that this is not a pitch.

HONESTY RULES
- Invent no statistics, no study, no percentage, and no customer quote that is not in the note or the headline above.
- If the note implies a number she has not given you, write the claim without the number rather than inventing one.
- Stay inside formulation chemistry and brand operations. Claim no medical or dermatological authority.

Output the post text only. No preamble, no explanation, no title.`;

  let text = await gemini(DRAFT_MODEL(), prompt, { temperature: 0.8 });
  return sanitize(text);
}

// Mechanical enforcement of the non-negotiable don'ts, in case the model slips.
export function sanitize(text) {
  return text
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/(^|\s)#[A-Za-z][\w-]*/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/!+/g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function verifyBlock(news) {
  if (!news) return '';
  return `\n\n─────────────────────────────────
NEWS SOURCE: ${news.headline}
FROM: ${news.source} · ${news.date}
LINK: ${news.link}
⚠ Check this before publishing — you are the author of this claim
─────────────────────────────────`;
}
