import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    // Rate limit: 5 requests per minute per IP
    const ip = getClientIp(req);
    const { success } = rateLimit(`scrape:${ip}`, { maxRequests: 5, windowMs: 60_000 });
    if (!success) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', message: '少しお時間をおいてから、もう一度お試しください。' },
        { status: 429 }
      );
    }

    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL_REQUIRED', message: 'noteのURLを教えてください。' },
        { status: 400 }
      );
    }

    // Validate it looks like a note.com URL
    const noteUrlPattern = /^https?:\/\/(note\.com|note\.mu)\/.+/i;
    if (!noteUrlPattern.test(url.trim())) {
      return NextResponse.json(
        { error: 'INVALID_URL', message: 'note.comの記事URLを教えてくださいね。' },
        { status: 400 }
      );
    }

    const targetUrl = url.trim();

    // Fetch the note page HTML
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'FETCH_FAILED', message: 'ごめんなさい、うまく読み取れませんでした。お手数ですが、本文を直接教えてもらえませんか？' },
        { status: 422 }
      );
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*?)"\s*\/?>/i)
      || html.match(/<title>([^<]*?)<\/title>/i);
    const title = titleMatch ? decodeHTMLEntities(titleMatch[1]) : '';

    // Strategy 1: Extract from JSON-LD structured data (most reliable)
    let bodyText = '';
    const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1]);
        if (ld.articleBody) {
          bodyText = ld.articleBody;
        } else if (ld.description) {
          bodyText = ld.description;
        }
      } catch {
        // JSON parse failed, try next strategy
      }
    }

    // Strategy 2: Extract from meta description
    if (!bodyText || bodyText.length < 100) {
      const descMatch = html.match(/<meta\s+(?:property="og:description"|name="description")\s+content="([^"]*?)"\s*\/?>/i);
      if (descMatch) {
        const desc = decodeHTMLEntities(descMatch[1]);
        if (desc.length > (bodyText?.length || 0)) {
          bodyText = desc;
        }
      }
    }

    // Strategy 3: Extract from note-body div content
    if (!bodyText || bodyText.length < 100) {
      const bodyMatch = html.match(/<div[^>]*class="[^"]*note-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (bodyMatch) {
        const cleaned = stripHtmlTags(bodyMatch[1]);
        if (cleaned.length > (bodyText?.length || 0)) {
          bodyText = cleaned;
        }
      }
    }

    // Strategy 4: Extract from article content area
    if (!bodyText || bodyText.length < 100) {
      const articleMatch = html.match(/<div[^>]*class="[^"]*p-article__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (articleMatch) {
        const cleaned = stripHtmlTags(articleMatch[1]);
        if (cleaned.length > (bodyText?.length || 0)) {
          bodyText = cleaned;
        }
      }
    }

    // Strategy 5: Look for __NEXT_DATA__ (note uses Next.js)
    if (!bodyText || bodyText.length < 100) {
      const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/i);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const bodyContent = extractFromNextData(nextData);
          if (bodyContent && bodyContent.length > (bodyText?.length || 0)) {
            bodyText = bodyContent;
          }
        } catch {
          // parse failed
        }
      }
    }

    if (!bodyText || bodyText.length < 50) {
      return NextResponse.json(
        { error: 'SCRAPE_FAILED', message: 'ごめんなさい、うまく読み取れませんでした。お手数ですが、本文を直接教えてもらえませんか？' },
        { status: 422 }
      );
    }

    // Truncate to reasonable length for AI analysis
    const maxLength = 8000;
    const truncatedBody = bodyText.length > maxLength
      ? bodyText.slice(0, maxLength) + '…'
      : bodyText;

    return NextResponse.json({
      title,
      body: truncatedBody,
    });
  } catch (error: unknown) {
    console.error('Scrape API error:', error);
    return NextResponse.json(
      { error: 'SCRAPE_FAILED', message: 'ごめんなさい、うまく読み取れませんでした。お手数ですが、本文を直接教えてもらえませんか？' },
      { status: 422 }
    );
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromNextData(data: any): string {
  try {
    // Navigate through Next.js data structure to find article body
    const props = data?.props?.pageProps;
    if (!props) return '';

    // Try different possible paths
    if (props.note?.body) return stripHtmlTags(props.note.body);
    if (props.noteBody) return stripHtmlTags(props.noteBody);
    if (props.article?.body) return stripHtmlTags(props.article.body);

    // Deep search for body content
    const bodyStr = JSON.stringify(props);
    const bodyMatch = bodyStr.match(/"body"\s*:\s*"([\s\S]*?)(?<!\\)"/);
    if (bodyMatch) {
      try {
        const decoded = JSON.parse(`"${bodyMatch[1]}"`);
        return stripHtmlTags(decoded);
      } catch {
        return stripHtmlTags(bodyMatch[1]);
      }
    }

    return '';
  } catch {
    return '';
  }
}
