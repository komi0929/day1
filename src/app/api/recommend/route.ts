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
5. **ISBN-13は正確に記載する（最重要）**：提案する書籍の実在確認を必ずGoogle検索で行い、その書籍の正しい「ISBN-13（13桁の数字、ハイフンなし）」を正確に取得して出力データに含めること。絶対に架空の番号を推論して生成してはならない。ISBNが確認できない場合は空文字にする

## labelの書き方（最重要）
labelはユーザーがこの本を読みたいと思うための**アイキャッチの一文**です。
- noteの文章に使われている具体的な言葉・表現を必ず引用または言い換えて使う
- 書籍の内容要約ではなく、「ユーザーの状況 × この本」の交差点にある一言
- 例: 「"売上が立たない"あなたに必要な視点」「迷いの正体を教えてくれる一冊」「"もう一人でいい"と思えた時に読む本」
- 短く刺さる表現（15〜30字）

## 出力JSON
\`\`\`json
{
  "books": [
    {
      "title": "正確な書籍タイトル",
      "author": "著者名",
      "isbn": "Google検索で確認した正確なISBN-13コード（13桁の数字）。確認できなかった場合は空文字",
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
  isbn?: string;
  label: string;
  summary: string;
  letter: string;
}

interface BookResult extends BookFromAI {
  thumbnail: string;
  amazonUrl: string;
}

/**
 * Resolve thumbnail URL on the server-side.
 * Checks Hanmoto (openBD) and NDL SIMULTANEOUSLY (not sequentially)
 * with a strict 1.5s timeout. Returns the first valid URL found.
 */
async function resolveBookCover(isbn: string): Promise<string> {
  const cleanIsbn = (isbn || '').replace(/[^0-9]/g, '');
  if (cleanIsbn.length !== 13) return '/default-cover.png';

  const hanmotoUrl = `https://cover.hanmoto.com/${cleanIsbn}.jpg`;
  const ndlUrl = `https://ndlsearch.ndl.go.jp/thumbnail/${cleanIsbn}.jpg`;

  // Check both sources simultaneously
  const checkUrl = async (url: string): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok ? url : null;
    } catch {
      return null;
    }
  };

  const results = await Promise.allSettled([checkUrl(hanmotoUrl), checkUrl(ndlUrl)]);

  // Prefer Hanmoto (priority 1), then NDL (priority 2)
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }

  return '/default-cover.png';
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

    // Phase 2: Concurrently build confirmed thumbnail URLs using server-side HEAD verification
    const enrichedBooks: BookResult[] = await Promise.all(books.map(async (book) => {
      const cleanIsbn = (book.isbn || '').replace(/[^0-9]/g, '');
      const validIsbn = cleanIsbn.length === 13 ? cleanIsbn : '';
      const thumbnail = await resolveBookCover(validIsbn);

      // Log ISBN for debugging
      console.log(`[ISBN] ${book.title}: raw="${book.isbn}" clean="${validIsbn}" thumb="${thumbnail}"`);

      return {
        ...book,
        isbn: validIsbn,
        thumbnail,
        amazonUrl: generateAmazonUrl(book.title, book.author),
      };
    }));

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
