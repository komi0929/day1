import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAuthClient } from '@/lib/supabase';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const maxDuration = 60;

const BOOK_COUNT = 3;
const AI_REQUEST_COUNT = 8;

function buildSystemPrompt() {
  return `あなたは、ユーザーの言葉を深く愛するプロの編集者です。

## ミッション
ユーザーが書いたnote本文をじっくり読み込み、その人の立場、悩み、課題感、そしてまだ言葉にできていない願いを行間から丁寧に読み解いてください。
その上で、「この人が今まさに読むべき一冊」を${AI_REQUEST_COUNT}冊分リストアップしてください。

## 推薦の鉄則
1. **実在する書籍のみ推薦する（最重要）**：確実に実在する書籍のみ推薦すること。架空の本は絶対に推薦しない。Amazonや書店で購入できる実在の書籍のみ。タイトルと著者名は一字一句正確に。「それっぽいタイトル」を創作しないこと。
2. **ISBN-13を正確に出力すること**：推薦する書籍のISBN-13（13桁の数字、ハイフンなし）を正確に出力すること。ISBNが不明・不確実な場合は空文字にする。絶対にISBNを創作・推測しないこと。
3. **既知すぎない名著・良書を選ぶ**：定番中の定番（7つの習慣、嫌われる勇気 等）は避ける
4. **${AI_REQUEST_COUNT}冊すべてが異なる切り口**：同じジャンル・同じ著者に偏らない
5. **noteの内容に深く紐づく**：汎用的なおすすめではなく、この人のこのnoteだからこそ選ばれた本であること
6. **主に日本の著者の和書から選書すること**。有名な出版社（岩波書店、講談社、新潮社、文藝春秋、ダイヤモンド社、NHK出版等）から出版された書籍を優先する
7. **楽天ブックスに掲載されている書籍を優先すること**：楽天ブックスで検索してヒットする書籍を中心に選ぶ。絶版や電子書籍のみの書籍は避ける

## labelの書き方（最重要）
labelはユーザーがこの本を読みたいと思うための**アイキャッチの一文**です。
- noteの文章に使われている具体的な言葉・表現を必ず引用または言い換えて使う
- 書籍の内容要約ではなく、「ユーザーの状況 × この本」の交差点にある一言
- 例: 「\\\\"売上が立たない\\\\"あなたに必要な視点」「迷いの正体を教えてくれる一冊」「\\\\"もう一人でいい\\\\"と思えた時に読む本」
- 短く刺さる表現（15〜30字）

## 出力JSON
\`\`\`json
{
  "books": [
    {
      "title": "正確な書籍タイトル",
      "author": "著者名",
      "isbn": "ISBN-13（13桁数字・ハイフンなし。不明なら空文字）",
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
  verifiedTitle: string;
  verifiedAuthor: string;
  verified: boolean;
}

// ============================================================
// 楽天APIレスポンスからヒットを抽出するヘルパー
// ============================================================
interface RakutenItem {
  title?: string;
  subTitle?: string;
  author?: string;
  isbn?: string;
  largeImageUrl?: string;
  mediumImageUrl?: string;
  affiliateUrl?: string;
  itemUrl?: string;
}

/**
 * 緩和版タイトルガード — 完全に無関係な本を弾くが、サブタイトル差異は許容
 * - ISBN検索: ガード不要（ISBNは一意）
 * - タイトル検索: このガードで「ブックページ」→「BOOK PAGE 本の年鑑」等を排除
 */
const normForMatch = (s: string) =>
  s.toLowerCase()
   .replace(/[\s\u3000・:：\-−–—「」『』()（）\[\]【】、。,./／!！?？]/g, '')
   .replace(/[ａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)); // 全角→半角

function titleLooseMatch(aiTitle: string, apiTitle: string): boolean {
  const a = normForMatch(aiTitle);
  const b = normForMatch(apiTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  // 部分一致: AIタイトルがAPIタイトルに含まれるか、その逆
  if (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))) return true;
  // 先頭一致: 最初の数文字が同じなら同じ本の可能性が高い
  const minLen = Math.min(a.length, b.length);
  const prefixLen = Math.min(minLen, 6); // 先頭6文字で判定
  if (a.slice(0, prefixLen) === b.slice(0, prefixLen)) return true;
  return false;
}

/** 楽天APIレスポンスから全Itemsを安全に抽出 */
function safeExtractRakutenItems(data: unknown): RakutenItem[] {
  try {
    if (!data || typeof data !== 'object') return [];
    const d = data as { Items?: unknown[] };
    if (!d.Items || !Array.isArray(d.Items) || d.Items.length === 0) return [];
    return d.Items
      .map(w => (w as { Item?: RakutenItem })?.Item)
      .filter((item): item is RakutenItem => !!item);
  } catch {
    return [];
  }
}



/** タイトルガード付きで最適なItemを選択（タイトル検索用） */
function findBestMatch(data: unknown, searchTitle: string): RakutenItem | null {
  const items = safeExtractRakutenItems(data);
  for (const item of items) {
    if (titleLooseMatch(searchTitle, item.title || '')) return item;
  }
  return null; // 全Items不一致 → 別の本なので採用しない
}

/** 楽天Itemから表紙URL取得 */
function getRakutenCover(item: RakutenItem): string {
  return (item.largeImageUrl || item.mediumImageUrl || '')
    .replace('?_ex=200x200', '?_ex=300x300')
    .replace('?_ex=120x120', '?_ex=300x300')
    .replace('?_ex=64x64', '?_ex=300x300');
}

/** 楽天ItemからCoverResultを構築 */
function rakutenItemToResult(item: RakutenItem): CoverResult {
  return {
    coverUrl: getRakutenCover(item),
    rakutenUrl: item.affiliateUrl || item.itemUrl || '',
    verifiedTitle: item.subTitle ? `${item.title} ${item.subTitle}`.trim() : (item.title || ''),
    verifiedAuthor: item.author || '',
    verified: true,
  };
}

// ============================================================
// 楽天タイトル+著者検索（ワンステップ）
// - AIのISBNは一切使わない（ハルシネーションの元凶）
// - Google Booksも使わない（不安定、429、キー問題）
// - 楽天タイトル+著者検索 + titleLooseMatchで確実にガード
// - 1冊あたりAPI 1回 = 最速
// ============================================================
const RAKUTEN_ORIGIN = 'https://compass.hitokoto.tech';
const rakutenHeaders = { 'Origin': RAKUTEN_ORIGIN };

async function getBookCover(title: string, author: string): Promise<CoverResult> {
  const empty: CoverResult = { coverUrl: '', rakutenUrl: '', verifiedTitle: '', verifiedAuthor: '', verified: false };

  const rakutenAppId = process.env.RAKUTEN_APP_ID || '';
  const rakutenAccessKey = process.env.RAKUTEN_ACCESS_KEY || '';
  const rakutenAffId = process.env.RAKUTEN_AFFILIATE_ID || '';

  if (!rakutenAppId || !rakutenAccessKey) {
    console.warn(`[V] 楽天API認証情報不足`);
    return empty;
  }

  const base = `https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId=${rakutenAppId}&accessKey=${rakutenAccessKey}&hits=5&format=json${rakutenAffId ? `&affiliateId=${rakutenAffId}` : ''}`;

  try {
    const url = `${base}&title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: rakutenHeaders });
    if (!res.ok) {
      console.warn(`[V] Rakuten HTTP ${res.status}: "${title}"`);
      return empty;
    }
    const data = await res.json();
    const item = findBestMatch(data, title);
    if (item && getRakutenCover(item)) {
      console.log(`[V] ✅ "${title}" → "${item.title}"`);
      return rakutenItemToResult(item);
    }
    console.log(`[V] ❌ "${title}" — 楽天に一致なし`);
    return empty;
  } catch (e) {
    console.warn(`[V] 楽天エラー: "${title}"`, e);
    return empty;
  }
}

// ============================================================
// 逐次検証 + 早期リターン
// ============================================================
async function verifyBooksSequentially(
  candidates: BookFromAI[],
  needed: number
): Promise<{ verified: BookResult[]; remaining: BookFromAI[] }> {
  const verified: BookResult[] = [];
  let lastCheckedIdx = -1;

  for (let i = 0; i < candidates.length; i++) {
    if (verified.length >= needed) break;
    lastCheckedIdx = i;

    const book = candidates[i];
    const coverResult = await getBookCover(book.title, book.author);

    if (!coverResult.verified || !coverResult.coverUrl) continue;

    const finalTitle = coverResult.verifiedTitle || book.title;
    const finalAuthor = coverResult.verifiedAuthor || book.author;

    verified.push({
      ...book,
      title: finalTitle,
      author: finalAuthor,
      thumbnail: coverResult.coverUrl,
      amazonUrl: generateAmazonUrl(finalTitle, finalAuthor),
      rakutenUrl: coverResult.rakutenUrl || generateRakutenUrl(finalTitle, finalAuthor),
    });
    console.log(`[V] ${verified.length}/${needed} done: "${finalTitle}"`);
  }

  return { verified, remaining: candidates.slice(lastCheckedIdx + 1) };
}

// ============================================================
// Main API Handler
// ============================================================
export async function POST(req: Request) {
  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 32768) {
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

    const { body: noteBody, title: noteTitle, excludeTitles, includeFragments, pendingCandidates } = await req.json();

    let candidates: BookFromAI[];
    let fragments: string[] = [];

    if (pendingCandidates && Array.isArray(pendingCandidates) && pendingCandidates.length > 0) {
      // Mode A: AI呼び出しスキップ（バッチ2/3用）
      candidates = pendingCandidates.filter(
        (c: Record<string, unknown>) => c && typeof c.title === 'string' && typeof c.author === 'string'
      ) as BookFromAI[];
      console.log(`[R] Mode A: ${candidates.length} pending`);
    } else {
      // Mode B: AI選書 + 検証
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
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
        },
      });

      // Heart profile context
      let pastContext = '';
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const supabase = createAuthClient(authHeader.replace('Bearer ', ''));
          if (supabase) {
            const { data: profiles } = await supabase
              .from('heart_profiles')
              .select('summary, created_at')
              .order('created_at', { ascending: false })
              .limit(5);
            if (profiles && profiles.length > 0) {
              pastContext = `\n\n## 過去の心のカルテ（あなたはこのユーザーを見守り続ける専属の編集者です）
以下は過去のセッションから読み取ったユーザーの心の記録です。

${profiles.map((p, i) => `[${i + 1}] ${new Date(p.created_at).toLocaleDateString('ja-JP')}:\n${p.summary}`).join('\n\n')}

【継続カウンセリング指示】
- 手紙の冒頭で、過去のカルテと今回のnoteを比較し、「時間経過や関心の変化」に優しく触れてください
- 例：「前回は〇〇について立ち止まっておられましたが、今日は少し視線が変わりましたね」「あの時の言葉を経て、今があるのですね」
- ただし「解決した」等と勝手に断定せず、どんな話題の転換も肯定的に受け止める表現にすること
- 初回利用の場合（カルテが0件）はこの指示を無視してください`;
            }
          }
        } catch (e) {
          console.error('Heart profile error:', e);
        }
      }

      let exclusionNote = '';
      if (excludeTitles && Array.isArray(excludeTitles) && excludeTitles.length > 0) {
        exclusionNote = `\n\n【除外する書籍】以下は既に推薦済みです。絶対に重複しないでください：\n${excludeTitles.map((t: string) => `- ${t}`).join('\n')}`;
      }

      const wantFragments = includeFragments !== false;

      const userPrompt = `以下のnote記事を深く読み解き、この筆者が「今まさに読むべき一冊」を${AI_REQUEST_COUNT}冊推薦してください。
候補は多めに出してください。この中から実在確認できたものだけを採用します。

━━━━━━━━━━━━━━━━
■ note記事タイトル: ${noteTitle || '（タイトルなし）'}
━━━━━━━━━━━━━━━━
${noteBody.trim().slice(0, 8000)}
━━━━━━━━━━━━━━━━

【最重要指示 — 実在書籍のみ】
- ${AI_REQUEST_COUNT}冊すべて、確実に実在する書籍であること。架空の書籍は絶対に禁止
- 書籍タイトルは「Amazonや楽天ブックスで検索してそのままヒットする正確なタイトル」を使うこと。1文字でもタイトルを変えたり省略したりするのは禁止
- 著者名も正確に。フルネームで記載すること
- ISBN-13（13桁数字、ハイフンなし）が確実にわかる場合のみ記載。不確実なら空文字にする
- 主に日本の著者の和書から選書すること。楽天ブックスに掲載されている書籍を優先する
- 定番すぎるベストセラーは避け、noteの内容に深く紐づいた書籍を選ぶ
- noteの具体的な言葉や感情を反映した、体温のある手紙形式の推薦文を書く
${wantFragments ? '- fragmentsはnote本文から印象的な一節を5〜8つ抽出する' : '- fragmentsは空配列[]にする'}
- label: noteの言葉を活かした、この本を読みたくなる一文（要約ではなく、筆者の状況とこの本の交差点にある言葉）${exclusionNote}

指定されたJSON形式のみ出力してください。`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'model', parts: [{ text: buildSystemPrompt() + pastContext }] },
      });

      const rawText = result.response.text();

      let jsonText = rawText;
      const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fenceMatch) jsonText = fenceMatch[1];
      if (!jsonText.trim().startsWith('{')) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonText = jsonMatch[0];
      }

      let aiResult;
      try {
        aiResult = JSON.parse(jsonText.trim());
      } catch {
        console.error('[R] JSON parse failed:', rawText.slice(0, 300));
        throw new Error('AIの応答を解析できませんでした');
      }
      candidates = aiResult.books || [];
      fragments = wantFragments ? (aiResult.fragments || []) : [];
      console.log(`[R] Mode B: AI → ${candidates.length} candidates`);
    }

    // 逐次検証（楽天 ISBN→T+A→T-only → Google Books カスケード）
    const { verified, remaining } = await verifyBooksSequentially(candidates, BOOK_COUNT);
    console.log(`[R] ${verified.length}/${BOOK_COUNT} verified | ${remaining.length} pending`);

    if (verified.length === 0) {
      return NextResponse.json(
        { error: 'RECOMMEND_FAILED', message: 'ごめんなさい、条件に合う本が見つかりませんでした。もう一度お試しください。' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      books: verified,
      fragments,
      pendingCandidates: remaining,
    });
  } catch (error: unknown) {
    console.error('Recommend error:', error);
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

function generateRakutenUrl(title: string, author: string): string {
  const query = encodeURIComponent(`${title} ${author}`);
  const affId = process.env.RAKUTEN_AFFILIATE_ID || '';
  const base = `https://books.rakuten.co.jp/search?sv=30&b=1&g=001&sitem=${query}`;
  return affId ? `${base}&aid=${affId}` : base;
}
