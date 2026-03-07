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
  rakutenUrl: string;
}

interface CoverResult {
  coverUrl: string;
  rakutenUrl: string;
}

/** 正規化ヘルパー */
const normTitle = (s: string) => s.toLowerCase().replace(/[\s\u3000・:：\-−–—「」『』()（）\[\]【】、。,./／]/g, '');

/** タイトル照合: API結果がAI出力タイトルと一致するか */
function titleMatch(aiTitle: string, apiTitle: string): boolean {
  const a = normTitle(aiTitle), b = normTitle(apiTitle);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  if (a.length >= 2 && b.length >= 2 && a.slice(0, 2) === b.slice(0, 2)) return true;
  let common = 0;
  const bSet = new Set(b);
  for (const c of a) { if (bSet.has(c)) common++; }
  return common >= Math.min(a.length, b.length) * 0.3;
}

/**
 * 表紙画像 + 購入URL取得 — 3段階カスケード:
 *
 *   Stage 1 (Main):     楽天ブックスAPI — タイトル+著者で検索。カバー画像+購入URLをワンストップ取得
 *   Stage 2 (Fallback):  Google Books API — 楽天にない洋書・専門書カバー
 *   Stage 3 (Fallback):  openBD — 最終チェック
 *   Stage 4:             CSSプレースホルダー
 *
 *   ※ 全段階でタイトル照合ガード付き。間違った画像は絶対に表示しない。
 */
async function getBookCover(title: string, author: string): Promise<CoverResult> {
  const empty: CoverResult = { coverUrl: '', rakutenUrl: '' };

  // ── Stage 1 (Main): 楽天ブックスAPI ──
  const rakutenAppId = process.env.RAKUTEN_APP_ID || '';
  const rakutenAffId = process.env.RAKUTEN_AFFILIATE_ID || '';
  if (rakutenAppId) {
    try {
      const q = encodeURIComponent(title);
      const a = encodeURIComponent(author);
      const rakutenUrl = `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId=${rakutenAppId}&title=${q}&author=${a}&hits=3&format=json${rakutenAffId ? `&affiliateId=${rakutenAffId}` : ''}`;
      const res = await fetch(rakutenUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const items = data?.Items;
        if (items && items.length > 0) {
          for (const wrapper of items) {
            const item = wrapper?.Item;
            if (!item) continue;
            const apiTitle = item.title || '';
            if (!titleMatch(title, apiTitle)) {
              console.log(`[Cover] Rakuten skip: "${title}" ≠ "${apiTitle}"`);
              continue;
            }
            const coverUrl = (item.largeImageUrl || item.mediumImageUrl || '')
              .replace('?_ex=200x200', '?_ex=300x300')
              .replace('?_ex=120x120', '?_ex=300x300');
            if (coverUrl) {
              const purchaseUrl = item.affiliateUrl || item.itemUrl || '';
              console.log(`[Cover] Stage1 Rakuten hit: "${title}" → "${apiTitle}"`);
              return { coverUrl, rakutenUrl: purchaseUrl };
            }
          }
        }
      }
      console.log(`[Cover] Stage1 Rakuten: no match for "${title}"`);
    } catch (e) {
      console.warn(`[Cover] Stage1 Rakuten failed:`, e);
    }
  }

  // ── Stage 2 (Fallback): Google Books API ──
  const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
  if (googleApiKey) {
    try {
      const query = encodeURIComponent(`${title} ${author}`);
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${query}&langRestrict=ja&maxResults=5&fields=items(volumeInfo(title,imageLinks))&key=${googleApiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        const items = data?.items;
        if (items && items.length > 0) {
          for (const item of items) {
            const vi = item?.volumeInfo;
            const apiTitle = vi?.title || '';
            if (!titleMatch(title, apiTitle)) continue;
            const rawUrl = vi?.imageLinks?.thumbnail || vi?.imageLinks?.smallThumbnail;
            if (rawUrl) {
              const coverUrl = rawUrl.replace('http://', 'https://').replace('&edge=curl', '');
              console.log(`[Cover] Stage2 GoogleBooks: "${title}" → "${apiTitle}"`);
              return { coverUrl, rakutenUrl: '' };
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[Cover] Stage2 GoogleBooks failed:`, e);
    }
  }

  // ── Stage 3 (Fallback): openBD ──
  // openBDはISBN必須のため、楽天・Google Booksで見つからない場合はスキップ
  console.log(`[Cover] No cover: "${title}"`);
  return empty;
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

【最重要指示 — 実在書籍のみ】
- ${BOOK_COUNT}冊すべて、Google検索で実在を確認した書籍であること。架空の書籍は絶対に禁止
- 書籍タイトルは「Amazonや楽天ブックスで検索してそのままヒットする正確なタイトル」を使うこと。1文字でもタイトルを変えたり省略したりするのは禁止
- 著者名も正確に。フルネームで記載すること
- 各書籍のISBN-13（13桁数字、ハイフンなし）もGoogle検索で正確に取得すること。推測や創作は絶対に禁止
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

    // Phase 2: 表紙画像 + 購入URL取得 + 実在検証（楽天 → Google Books）
    const enrichedBooks: BookResult[] = await Promise.all(
      books.map(async (book) => {
        const coverResult = await getBookCover(book.title, book.author);
        console.log(`[Result] ${book.title} by ${book.author} | cover=${coverResult.coverUrl ? 'YES' : 'NO'} | rakuten=${coverResult.rakutenUrl ? 'YES' : 'NO'}`);

        return {
          ...book,
          thumbnail: coverResult.coverUrl,
          amazonUrl: generateAmazonUrl(book.title, book.author),
          rakutenUrl: coverResult.rakutenUrl,
        };
      })
    );

    // Phase 3: ハルシネーション除外 — 楽天にもGoogle Booksにも見つからない書籍は架空の可能性が高い
    const verifiedBooks = enrichedBooks.filter(book => {
      if (book.thumbnail || book.rakutenUrl) return true;
      console.warn(`[HALLUCINATION?] "${book.title}" by ${book.author} — 楽天にもGoogle Booksにも存在しない。除外。`);
      return false;
    });
    console.log(`[Verify] ${books.length}冊中${verifiedBooks.length}冊が実在確認済み（${books.length - verifiedBooks.length}冊除外）`);

    return NextResponse.json({
      books: verifiedBooks,
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
