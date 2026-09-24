// Google News RSS. No key, no account.

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export async function topNewsItem(phrase) {
  if (!phrase) return null;

  const locale = process.env.NEWS_LOCALE || 'IN';
  const url =
    'https://news.google.com/rss/search?q=' +
    encodeURIComponent(`${phrase} when:30d`) +
    `&hl=en-${locale}&gl=${locale}&ceid=${locale}:en`;

  let xml;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    xml = await res.text();
  } catch {
    return null;
  }

  const item = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!item) return null;

  const pick = (tag) => {
    const m = item[1].match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
    return m ? decode(m[1]) : '';
  };

  let headline = pick('title');
  if (!headline) return null;

  // Google News appends " - Publisher" to the headline. Split it back off.
  let source = pick('source');
  if (source && headline.endsWith(` - ${source}`)) {
    headline = headline.slice(0, -(source.length + 3)).trim();
  } else if (!source) {
    const tail = headline.lastIndexOf(' - ');
    if (tail > 20) {
      source = headline.slice(tail + 3).trim();
      headline = headline.slice(0, tail).trim();
    }
  }

  const pubDate = pick('pubDate');
  return {
    headline,
    link: pick('link'),
    source: source || 'Google News',
    date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '',
  };
}
