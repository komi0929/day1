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
1. **実在する書籍のみ推薦する（最重要）**：Google検索で実在を確認した書籍のみ推薦すること。架空の本は絶対に推薦しない。Amazonや書店で購入できる実在の書籍のみ。タイトルと著者名は一字一句正確に。「それっぽいタイトル」を創作しないこと。
2. **ISBN-13は必ずGoogle検索で確認して正確に出力すること**：推薦する書籍のISBN-13（13桁の数字、ハイフンなし）をGoogle検索で正確に取得し出力すること。ISBNが見つからない場合は空文字にする。絶対にISBNを創作・推測しないこと。
3. **既知すぎない名著・良書を選ぶ**：定番中の定番（7つの習慣、嫌われる勇気 等）は避ける
4. **${BOOK_COUNT}冊すべてが異なる切り口**：同じジャンル・同じ著者に偏らない
5. **noteの内容に深く紐づく**：汎用的なおすすめではなく、この人のこのnoteだからこそ選ばれた本であること
6. **主に日本の著者の和書から選書すること**。有名な出版社（岩波書店、講談社、新潮社、文藝春秋、ダイヤモンド社、NHK出版等）から出版された書籍を優先する

## labelの書き方（最重要）
labelはユーザーがこの本を読みたいと思うための**アイキャッチの一文**です。
- noteの文章に使われている具体的な言葉・表現を必ず引用または言い換えて使う
- 書籍の内容要約ではなく、「ユーザーの状況 × この本」の交差点にある一言
- 例: 「\\"売上が立たない\\"あなたに必要な視点」「迷いの正体を教えてくれる一冊」「\\"もう一人でいい\\"と思えた時に読む本」
- 短く刺さる表現（15〜30字）

## 出力JSON
\`\`\`json
{
  "books": [
    {
      "title": "正確な書籍タイトル",
      "author": "著者名",
      "isbn": "ISBN-13（13桁数字・ハイフンなし。Google検索で確認した正確な値。不明なら空文字）",
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
  isbn: string;
  label: string;
  summary: string;
  letter: string;
}

interface BookResult extends BookFromAI {
  thumbnail: string;
  amazonUrl: string;
}

/**
 * タイトル簡易照合: GoogleBooks/openBDから返ったタイトルがAI出力タイトルと大まかに一致するか
 */
function looseTitleMatch(aiTitle: string, apiTitle: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\u3000・:：\-−–—「」『』()（）]/g, '');
  const a = norm(aiTitle);
  const b = norm(apiTitle);
  // 一方が他方を含むか、先頭5文字以上が一致すればOK
  return a.includes(b) || b.includes(a) || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));
}

/**
 * 表紙画像URL取得 — ISBN検索 + タイトル照合ガード:
 *   1. Google Books API「ISBN検索」 — ISBNで検索 + タイトル照合で誤画像防止
 *   2. openBD /v1/get API — Google Booksにない場合 + タイトル照合
 *   3. 空文字 → CSSプレースホルダー
 */
async function getBookCover(isbn: string, title: string): Promise<string> {
  if (!isbn || !/^\d{13}$/.test(isbn)) {
    console.log(`[Cover] No valid ISBN for "${title}" — using placeholder`);
    return '';
  }

  // ── Stage 1: Google Books API（ISBN検索 + タイトル照合ガード） ──
  const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
  if (googleApiKey) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&fields=items(volumeInfo(title,imageLinks))&key=${googleApiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        const items = data?.items;
        if (items && items.length > 0) {
          const vi = items[0]?.volumeInfo;
          const apiTitle = vi?.title || '';
          const imageLinks = vi?.imageLinks;
          const rawUrl = imageLinks?.thumbnail || imageLinks?.smallThumbnail;

          if (rawUrl && looseTitleMatch(title, apiTitle)) {
            const url = rawUrl
              .replace('http://', 'https://')
              .replace('&edge=curl', '');
            console.log(`[Cover] GoogleBooks ISBN hit for "${title}" (API: "${apiTitle}"): ${url}`);
            return url;
          } else if (rawUrl) {
            console.warn(`[Cover] GoogleBooks ISBN MISMATCH: "${title}" ≠ "${apiTitle}" — skipping wrong cover`);
          }
        }
      }
      console.log(`[Cover] GoogleBooks no match for ISBN=${isbn} ("${title}")`);
    } catch (e) {
      console.warn(`[Cover] GoogleBooks ISBN search failed for "${title}":`, e);
    }
  }

  // ── Stage 2: openBD /v1/get API + タイトル照合 ──
  try {
    const openbdRes = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (openbdRes.ok) {
      const openbdData = await openbdRes.json();
      const summary = openbdData?.[0]?.summary;
      const coverUrl = summary?.cover;
      const openbdTitle = summary?.title || '';

      if (coverUrl && looseTitleMatch(title, openbdTitle)) {
        console.log(`[Cover] openBD hit for "${title}" (API: "${openbdTitle}"): ${coverUrl}`);
        return coverUrl;
      } else if (coverUrl) {
        console.warn(`[Cover] openBD ISBN MISMATCH: "${title}" ≠ "${openbdTitle}" — skipping`);
      }
    }
    console.log(`[Cover] openBD no cover for ISBN=${isbn} ("${title}")`);
  } catch (e) {
    console.warn(`[Cover] openBD failed for "${title}":`, e);
  }

  console.log(`[Cover] No cover found for "${title}" (ISBN=${isbn})`);
  return '';
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

    // Google Search Grounding有効化 — AIが実在書籍を検索してISBNを取得する
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

【最重要指示】
- ${BOOK_COUNT}冊すべて、Google検索で実在を確認した書籍であること。架空の書籍は絶対に禁止
- 各書籍のISBN-13（13桁数字、ハイフンなし）をGoogle検索で正確に取得すること。推測や創作は絶対に禁止
- 主に日本の著者の和書から選書すること
- 定番すぎるベストセラーは避け、noteの内容に深く紐づいた書籍を選ぶ
- noteの具体的な言葉や感情を反映した、体温のある手紙形式の推薦文を書く
${wantFragments ? '- fragmentsはnote本文から印象的な一節を5〜8つ抽出する' : '- fragmentsは空配列[]にする'}
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

    // Phase 2: 表紙画像取得（openBD: ISBN → カバー画像）
    const enrichedBooks: BookResult[] = await Promise.all(
      books.map(async (book) => {
        // ISBNバリデーション: 13桁数字のみ有効
        const isbn = (book.isbn || '').replace(/[^0-9]/g, '');
        const validIsbn = isbn.length === 13 ? isbn : '';

        const thumbnail = await getBookCover(validIsbn, book.title);
        console.log(`[Result] ${book.title} by ${book.author} | ISBN=${validIsbn || 'N/A'} | cover=${thumbnail ? 'YES' : 'NO'}`);

        return {
          ...book,
          isbn: validIsbn,
          thumbnail,
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
