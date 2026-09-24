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
