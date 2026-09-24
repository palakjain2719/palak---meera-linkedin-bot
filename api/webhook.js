import { sendMessage, sendTyping, downloadFile } from '../lib/telegram.js';
import { transcribe, screen, newsAngle, draft, verifyBlock } from '../lib/pipeline.js';
import { saveNote, saveDraft, resolveLatestDraft, storeEnabled } from '../lib/store.js';

const HELP = `Send me a note. Type it, or just record a voice message - I transcribe those.

I screen it first. If there is a post in it, I write the draft in your voice and send it back. If there isn't, I tell you why and stop.

Reply APPROVE or REJECT on a draft to log what you did with it.`;

export default async function handler(req, res) {
  // Telegram retries a webhook it thinks failed, so acknowledge everything.
  if (req.method !== 'POST') return res.status(200).send('ok');

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).send('no');
  }

  const update = req.body || {};
  const msg = update.message || update.channel_post || update.edited_message;
  const chatId = msg?.chat?.id;
  const audio = msg?.voice || msg?.audio || msg?.video_note;
  const text = (msg?.text || msg?.caption || '').trim();

  if (!chatId || (!text && !audio)) return res.status(200).send('ok');

  if (!isAllowed(chatId)) {
    console.log('ignored chat', chatId);
    return res.status(200).send('ok');
  }

  try {
    await run(chatId, text, msg, audio);
  } catch (err) {
    console.error(err);
    await sendMessage(chatId, `Something broke before a draft was made.\n\n${err.message}`).catch(() => {});
  }

  return res.status(200).send('ok');
}

async function run(chatId, text, msg, audio) {
  // A voice note becomes text first, then goes through the same pipeline.
  if (audio) {
    await sendTyping(chatId);
    const buffer = await downloadFile(audio.file_id);
    text = await transcribe(buffer, audio.mime_type || 'audio/ogg');

    if (!text || text.length < 15) {
      return sendMessage(chatId, 'I could not make out enough of that to work with. Try again, or type it.');
    }
    await sendMessage(chatId, `Heard:\n\n"${text}"`);
  }

  if (/^\/(start|help)\b/i.test(text)) {
    return sendMessage(chatId, HELP);
  }

  if (/^(approve|reject)$/i.test(text)) {
    const status = text.toLowerCase();
    if (!storeEnabled()) {
      return sendMessage(chatId, 'Noted. Nothing is being stored yet, so this is not logged anywhere.');
    }
    const row = await resolveLatestDraft(chatId, status);
    return sendMessage(chatId, row ? `Logged as ${status}.` : 'No pending draft to log.');
  }

  if (text.length < 15) {
    return sendMessage(chatId, 'Too short to work with. Give me the thought, not the title.');
  }

  await sendTyping(chatId);

  // 1. Screen.
  const screening = await screen(text);
  const note = await saveNote({
    chatId,
    messageId: msg?.message_id,
    text,
    score: screening.score,
    reason: screening.reason,
    passed: screening.passed,
  });

  if (!screening.passed) {
    return sendMessage(
      chatId,
      `No draft on this one. ${screening.score}/10.\n\n${screening.reason}\n\nIf there is more to it than this, send the part that has the claim in it.`
    );
  }

  // 2. News angle. Optional - a miss never blocks the draft.
  await sendTyping(chatId);
  const news = await newsAngle(screening.searchPhrase);

  // 3. Draft.
  await sendTyping(chatId);
  const body = await draft(text, screening, news);

  await saveDraft({ chatId, noteId: note?.id, body, newsUrl: news?.link });

  const usedNews = Boolean(news) && sharesWording(body, news.headline);
  const header = `Draft · note scored ${screening.score}/10\n\n`;

  return sendMessage(chatId, header + body + (usedNews ? verifyBlock(news) : ''));
}

// The draft is told to ignore an irrelevant headline, so only attach the verify
// block when the post actually leans on it.
function sharesWording(body, headline) {
  const stop = new Set(['the','a','an','and','or','of','to','in','for','on','with','is','are','from','that','this','as','at','by','it','its']);
  const words = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  if (!words.length) return false;
  const lower = body.toLowerCase();
  const hits = words.filter((w) => lower.includes(w)).length;
  return hits / words.length >= 0.4;
}

// ALLOWED_CHAT_ID accepts one id or a comma-separated list. Channel and supergroup
// ids arrive negative (-100...) while the dashboard usually shows them without the
// sign, so compare on digits only.
function isAllowed(chatId) {
  const raw = (process.env.ALLOWED_CHAT_ID || '').trim();
  if (!raw) return true;
  const digits = (v) => String(v).replace(/\D/g, '');
  const incoming = digits(chatId);
  return raw.split(',').some((id) => {
    const want = digits(id);
    return want && want === incoming;
  });
}
