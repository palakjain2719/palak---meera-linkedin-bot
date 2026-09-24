// Optional memory layer. Every function is a no-op when Supabase is not configured,
// so the bot runs fine before you set it up.

const on = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function rest(path, { method = 'POST', body, query = '' } = {}) {
  if (!on()) return null;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}${query}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    console.error('supabase', path, res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function saveNote({ chatId, messageId, text, score, reason, passed }) {
  return rest('notes', {
    body: [{
      chat_id: String(chatId),
      telegram_message_id: messageId,
      text,
      score,
      reason,
      passed,
    }],
  });
}

export async function saveDraft({ chatId, noteId, body, newsUrl }) {
  return rest('drafts', {
    body: [{
      chat_id: String(chatId),
      note_id: noteId ?? null,
      body,
      news_url: newsUrl || null,
      status: 'pending',
    }],
  });
}

// Meera replies APPROVE or REJECT; the newest pending draft in that chat updates.
export async function resolveLatestDraft(chatId, status) {
  if (!on()) return null;
  const latest = await rest('drafts', {
    method: 'GET',
    query: `?chat_id=eq.${encodeURIComponent(String(chatId))}&status=eq.pending&order=created_at.desc&limit=1`,
  });
  if (!latest?.id) return null;
  return rest('drafts', {
    method: 'PATCH',
    query: `?id=eq.${latest.id}`,
    body: { status, resolved_at: new Date().toISOString() },
  });
}

export const storeEnabled = on;
