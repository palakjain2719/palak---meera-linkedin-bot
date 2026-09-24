const api = (method) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export async function sendMessage(chatId, text, extra = {}) {
  // Telegram caps a message at 4096 characters.
  const chunks = text.match(/[\s\S]{1,3900}/g) || [''];
  for (const chunk of chunks) {
    await fetch(api('sendMessage'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
        ...extra,
      }),
    });
  }
}

export async function sendTyping(chatId) {
  await fetch(api('sendChatAction'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });
}

// Telegram caps getFile downloads at 20MB, which a voice note never approaches.
export async function downloadFile(fileId) {
  const meta = await fetch(api('getFile'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  }).then((r) => r.json());

  const path = meta?.result?.file_path;
  if (!path) throw new Error(`Telegram would not hand over the file: ${meta?.description || 'unknown reason'}`);

  const res = await fetch(
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${path}`
  );
  if (!res.ok) throw new Error(`Could not download the voice note (${res.status})`);

  return Buffer.from(await res.arrayBuffer());
}
