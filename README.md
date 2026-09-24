# Meera's LinkedIn draft bot

Telegram in, LinkedIn draft out. No web app, no auto-publishing.

## Flow

0. If she sends a voice note, Gemini transcribes it first and the bot echoes back
   what it heard, so a mis-hearing is visible before anything is written.
1. Meera sends a note to the bot on Telegram - typed or spoken.
2. Gemini scores it 0–10 against what she actually writes about. Below 6, the bot
   replies with the reason and stops.
3. Gemini pulls a search phrase; Google News RSS returns the top item from the
   last 30 days.
4. Gemini writes the post using `voice-skill.txt` as a hard constraint, plus
   LinkedIn formatting and honesty rules.
5. The draft comes back in the same chat. If it used the news item, a verify
   block with headline, source, date and link is appended.
6. She replies APPROVE or REJECT to log it (only if Supabase is configured).

## Files

| File | What it does |
| --- | --- |
| `api/webhook.js` | The Telegram webhook. The whole flow lives here. |
| `lib/pipeline.js` | Transcription, screening, news angle, drafting, the sanitizer, the verify block. |
| `lib/gemini.js` | Gemini API call. |
| `lib/news.js` | Google News RSS. No key needed. |
| `lib/telegram.js` | sendMessage, typing indicator, voice-note download. |
| `lib/store.js` | Optional Supabase memory. No-ops when unconfigured. |
| `voice-skill.txt` | The voice constraint. Edit this to change how she sounds. |

## Deploy

1. Push to GitHub.
2. Import the repo in Vercel. Add the environment variables from `.env.example`
   under Settings → Environment Variables. Deploy.
3. Point Telegram at it (one browser tab, once):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-project>.vercel.app/api/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

You should see `"ok":true`. Drop `&secret_token=...` if you left that variable blank.

4. Message the bot.

## Testing the pipeline without Telegram

```
GEMINI_API_KEY=... node test-local.js "your note here"
```
