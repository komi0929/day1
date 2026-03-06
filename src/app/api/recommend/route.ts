import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAuthClient } from '@/lib/supabase';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const BOOK_COUNT = 3;

function buildSystemPrompt() {
  return `あなたは、ユーザーの言葉を深く愛するプロの編集者です。

## ミッション
ユーザーが書いたnote本文をじっくり読み込み、その人の立場、悩み、課題感、そしてまだ言葉にできていない願いを行間から丁寧に読み解いてください。
その上で、「この人が今まさに読むべき一冊」を${BOOK_COUNT}冊分リストアップしてください。

## 推薦の鉄則
1. **既知すぎない名著・良書を選ぶ**：定番中の定番（7つの習慣、嫌われる勇気 等）は避け、実在する具体的な書籍を推薦する
2. **実在する書籍のみ**：架空の本は絶対に推薦しない。タイトルと著者名は正確に
3. **${BOOK_COUNT}冊すべてが異なる切り口**：同じジャンル・同じ著者に偏らない
4. **noteの内容に深く紐づく**：汎用的なおすすめではなく、この人のこのnoteだからこそ選ばれた本であること
5. **主に日本の著者の和書から選書すること**

## labelの書き方（最重要）
labelはユーザーがこの本を読みたいと思うための**アイキャッチの一文**です。
- noteの文章に使われている具体的な言葉・表現を必ず引用または言い換えて使う
- 書籍の内容要約ではなく、「ユーザーの状況 × この本」の交差点にある一言
- 例: 「\"売上が立たない\"あなたに必要な視点」「迷いの正体を教えてくれる一冊」「\"もう一人でいい\"と思えた時に読む本」
- 短く刺さる表現（15〜30字）

## 出力JSON（ISBNは不要。システムが自動検索します）
\`\`\`json
{
  "books": [
    {
      "title": "正確な書籍タイトル",
      "author": "著者名",
      "label": "noteの言葉を活かしたアイキャッチ（15〜30字）",
      "summary": "客観的な書籍概要（100〜150字）",
      "letter": "手紙形式の推薦文（200〜400字）。ユーザーのnote本文の具体的な言葉を引用し、体温を感じる文章に。"
    }
  ],
  "fragments": ["note本文から印象的な一節を5〜8つ抽出。各20〜60字程度"]
}
\`\`\``;
}

interface BookFromAI {
  title: string;
  author: string;
  label: string;
  summary: string;
  letter: string;
}

interface BookResult extends BookFromAI {
  thumbnail: string;
  thumbnailFallback: string;
  amazonUrl: string;
}

/**
 * Search NDL (National Diet Library) by book title to find the real ISBN-13.
 * This replaces AI-generated ISBNs which are frequently hallucinated.
 */
async function searchIsbnByTitle(title: string, author: string): Promise<string> {
  try {
    const query = encodeURIComponent(title);
    const res = await fetch(
      `https://ndlsearch.ndl.go.jp/api/opensearch?title=${query}&cnt=3`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return '';
    const xml = await res.text();

    // Extract all ISBN-13s from the response
    const isbnMatches = xml.match(/ISBN[^<]*<\/dc:identifier>/g) || [];
    // Also try the typed identifier pattern
    const typedMatches = xml.match(/<dc:identifier[^>]*xsi:type="dcndl:ISBN"[^>]*>([^<]+)/g) || [];

    const allIsbns: string[] = [];
    for (const m of [...isbnMatches, ...typedMatches]) {
      const digits = m.replace(/[^0-9X]/gi, '');
      // Accept ISBN-13 (13 digits) or ISBN-10 (10 chars)
      if (digits.length === 13) {
        allIsbns.push(digits);
      } else if (digits.length === 10) {
        // Convert ISBN-10 to ISBN-13
        const isbn13 = convertIsbn10to13(digits);
        if (isbn13) allIsbns.push(isbn13);
      }
    }

    // Also extract from raw text patterns like 978-4-344-03833-2
    const rawMatches = xml.match(/97[89][-\d]{10,}/g) || [];
    for (const m of rawMatches) {
      const digits = m.replace(/[^0-9]/g, '');
      if (digits.length === 13) allIsbns.push(digits);
    }

    if (allIsbns.length > 0) {
      console.log(`[NDL] Found ISBNs for "${title}": ${allIsbns.join(', ')}`);
      return allIsbns[0];
    }

    console.log(`[NDL] No ISBN found for "${title}"`);
    return '';
  } catch (e) {
    console.warn(`[NDL] Search failed for "${title}":`, e);
    return '';
  }
}

function convertIsbn10to13(isbn10: string): string {
  const prefix = '978' + isbn10.substring(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(prefix[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return prefix + check;
}

function buildThumbnailUrls(isbn: string): { primary: string; fallback: string } {
  if (!isbn || isbn.length !== 13) {
    return { primary: '', fallback: '' };
  }
  return {
    primary: `https://cover.openbd.jp/${isbn}.jpg`,
    fallback: `https://ndlsearch.ndl.go.jp/thumbnail/${isbn}.jpg`,
  };
}

export async function POST(req: Request) {
  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 16384) {
      return NextResponse.json(
        { error: 'PAYLOAD_TOO_LARGE', message: 'リクエストが大きすぎます。' },
        { status: 413 }
      );
    }

    const ip = getClientIp(req);
    const { success: rateLimitOk } = rateLimit(`recommend:${ip}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', message: '少しお時間をおいてから、もう一度お試しください。' },
        { status: 429 }
      );
    }

    const { body: noteBody, title: noteTitle, excludeTitles, includeFragments } = await req.json();

    if (!noteBody || typeof noteBody !== 'string' || noteBody.trim().length < 50) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'もう少しだけ文章を教えてください（50文字以上お願いします）' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SERVER_CONFIG_ERROR', message: '申し訳ありません、ただいま準備中です。' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Phase 1: Enable Google Search Grounding for accurate ISBN retrieval
    // CRITICAL: responseMimeType:'application/json' + googleSearch causes grounding to be
    // silently ignored. Use text mode and parse JSON manually.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolConfig: any[] = [{ googleSearch: {} }];
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      },
      tools: toolConfig,
    });

    // Heart profile context
    let pastContext = '';
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const authToken = authHeader.replace('Bearer ', '');
      try {
        const supabase = createAuthClient(authToken);
        if (supabase) {
          const { data: profiles } = await supabase
            .from('heart_profiles')
            .select('summary, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          if (profiles && profiles.length > 0) {
            pastContext = `\n\n## 過去の心のカルテ\n${profiles.map((p, i) => `[${i + 1}] ${new Date(p.created_at).toLocaleDateString('ja-JP')}:\n${p.summary}`).join('\n\n')}`;
          }
        }
      } catch (e) {
        console.error('Failed to fetch heart profiles:', e);
      }
    }

    // Exclusion list
    let exclusionNote = '';
    if (excludeTitles && Array.isArray(excludeTitles) && excludeTitles.length > 0) {
      exclusionNote = `\n\n【除外する書籍】以下は既に推薦済みです。絶対に重複しないでください：\n${excludeTitles.map((t: string) => `- ${t}`).join('\n')}`;
    }

    const wantFragments = includeFragments !== false;

    const userPrompt = `以下のnote記事を深く読み解き、この筆者が「今まさに読むべき一冊」を${BOOK_COUNT}冊推薦してください。

━━━━━━━━━━━━━━━━
■ note記事タイトル: ${noteTitle || '（タイトルなし）'}
━━━━━━━━━━━━━━━━
${noteBody.trim().slice(0, 8000)}
━━━━━━━━━━━━━━━━

【重要な指示】
- ${BOOK_COUNT}冊すべて実在する書籍であること（架空の本は絶対に推薦しない）
- 主に日本の著者の和書から選書すること（noteの文脈に極めて深く合致する場合のみ、海外の翻訳書も含めてよい）
- 定番すぎるベストセラーは避け、noteの内容に深く紐づいた書籍を選ぶ
- noteの具体的な言葉や感情を反映した、体温のある手紙形式の推薦文を書く
${wantFragments ? '- fragmentsはnote本文から印象的な一節を5〜8つ抽出する' : '- fragmentsは空配列[]にする'}
- isbn: Google検索で正確なISBN-13（13桁数字、ハイフンなし）を取得。確認できなければ空文字
- label: noteの言葉を活かした、この本を読みたくなる一文（要約ではなく、筆者の状況とこの本の交差点にある言葉）${exclusionNote}

出力は上記で指定されたJSON形式のみを、コードブロック(\`\`\`json ... \`\`\`)で囲んで出力してください。JSON以外のテキストは一切出力しないでください。`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { role: 'model', parts: [{ text: buildSystemPrompt() + pastContext }] },
    });

    const rawText = result.response.text();

    // Parse JSON from text response (may be wrapped in ```json fences)
    let jsonText = rawText;
    const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) jsonText = fenceMatch[1];

    // Fallback: try to find raw JSON object
    if (!jsonText.trim().startsWith('{')) {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonText = jsonMatch[0];
    }

    const aiResult = JSON.parse(jsonText.trim());
    const books: BookFromAI[] = aiResult.books || [];
    const fragments: string[] = aiResult.fragments || [];

    // Phase 2: Search real ISBNs via NDL, then build cover URLs
    const enrichedBooks: BookResult[] = await Promise.all(
      books.map(async (book) => {
        const isbn = await searchIsbnByTitle(book.title, book.author);
        const { primary, fallback } = buildThumbnailUrls(isbn);

        console.log(`[Cover] ${book.title}: isbn="${isbn}" primary="${primary || '(none)'}"`);

        return {
          ...book,
          isbn,
          thumbnail: primary,
          thumbnailFallback: fallback,
          amazonUrl: generateAmazonUrl(book.title, book.author),
        };
      })
    );

    return NextResponse.json({
      books: enrichedBooks,
      fragments: wantFragments ? fragments : [],
    });
  } catch (error: unknown) {
    console.error('Recommend API error:', error);
    return NextResponse.json(
      { error: 'RECOMMEND_FAILED', message: 'ごめんなさい、本を探せませんでした。もう一度お試しください。' },
      { status: 500 }
    );
  }
}

function generateAmazonUrl(title: string, author: string): string {
  const query = encodeURIComponent(`${title} ${author}`);
  const tag = process.env.AMAZON_ASSOCIATE_TAG || 'compass08d-22';
  return `https://www.amazon.co.jp/s?k=${query}&tag=${tag}`;
}
