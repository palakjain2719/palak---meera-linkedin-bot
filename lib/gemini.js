// Thin wrapper around the Gemini generateContent endpoint.

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function gemini(model, prompt, { json = false, temperature = 0.7 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 2048,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const res = await fetch(`${API_ROOT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini ${model} failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
  }

  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();

  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

export function parseJson(text) {
  // Gemini occasionally wraps JSON in a fenced block even in JSON mode.
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}
