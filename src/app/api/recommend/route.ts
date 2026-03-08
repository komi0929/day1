import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAuthClient } from '@/lib/supabase';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const BOOK_COUNT = 3;  // フロントに返す冊数
const AI_REQUEST_COUNT = 9;  // AIに出力させる冊数（楽天API検証で除外される分を見越して多めに要求）

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

interface RakutenVerifyResult {
  coverUrl: string;
  rakutenUrl: string;
  verifiedTitle: string;
  verifiedAuthor: string;
  verified: boolean;
}

/** 正規化ヘルパー */
const normTitle = (s: string) => s.toLowerCase().replace(/[\s\u3000・:：\-−–—「」『』()（）\[\]【】、。,./／]/g, '');

/** タイトル照合: 厳格なLevenshtein距離ベース (70%以上類似度を要求) */
function titleMatch(aiTitle: string, apiTitle: string): boolean {
  const a = normTitle(aiTitle), b = normTitle(apiTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return false;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return (1 - dp[m][n] / maxLen) >= 0.7;
}

/**
 * 楽天APIグローバルレートリミッター
 * Rakuten APIの制限（1リクエスト/秒/アプリID）を全APIコールで共有
 */
let lastRakutenCallTime = 0;
async function rateLimitedRakutenFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRakutenCallTime;
  if (elapsed < 1200) {
    await new Promise(resolve => setTimeout(resolve, 1200 - elapsed));
  }
  lastRakutenCallTime = Date.now();
  return fetch(url, { signal: AbortSignal.timeout(5000) });
}

/**
 * 楽天APIレスポンスからタイトル照合 + 表紙取得を試みるヘルパー
 */
function extractVerifiedFromRakutenItems(
  items: unknown[],
  aiTitle: string
): RakutenVerifyResult | null {
  for (const wrapper of items as { Item?: Record<string, string> }[]) {
    const item = wrapper?.Item;
    if (!item) continue;
    const apiTitle = item.title || '';
    if (!titleMatch(aiTitle, apiTitle)) {
      console.log(`[Verify] Rakuten skip: "${aiTitle}" ≠ "${apiTitle}"`);
      continue;
    }

    const coverUrl = (item.largeImageUrl || item.mediumImageUrl || '')
      .replace('?_ex=200x200', '?_ex=300x300')
      .replace('?_ex=120x120', '?_ex=300x300');

    if (!coverUrl) {
      console.log(`[Verify] Rakuten title match but NO COVER: "${aiTitle}" → "${apiTitle}"`);
      continue;
    }

    const purchaseUrl = item.affiliateUrl || item.itemUrl || '';
    const apiAuthor = item.author || '';
    return {
      coverUrl,
      rakutenUrl: purchaseUrl,
      verifiedTitle: apiTitle,
      verifiedAuthor: apiAuthor,
      verified: true,
    };
  }
  return null;
}

/**
 * 楽天ブックスAPIで実在検証 + 表紙画像取得
 *
 * 2段階検索:
 *   Stage 1: タイトル + 著者名 → 精度重視
 *   Stage 2: タイトルのみ → 著者名フォーマット不一致の救済（マッチ率向上）
 */
async function verifyWithRakuten(title: string, author: string): Promise<RakutenVerifyResult> {
  const empty: RakutenVerifyResult = { coverUrl: '', rakutenUrl: '', verifiedTitle: '', verifiedAuthor: '', verified: false };

  const rakutenAppId = process.env.RAKUTEN_APP_ID || '';
  const rakutenAffId = process.env.RAKUTEN_AFFILIATE_ID || '';
  if (!rakutenAppId) {
    console.warn('[Verify] RAKUTEN_APP_ID not set');
    return empty;
  }

  const baseUrl = `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId=${rakutenAppId}&hits=5&format=json${rakutenAffId ? `&affiliateId=${rakutenAffId}` : ''}`;

  // ── Stage 1: タイトル + 著者名で検索（精度重視） ──
  try {
    const url1 = `${baseUrl}&title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`;
    const res1 = await rateLimitedRakutenFetch(url1);
    if (res1.ok) {
      const data1 = await res1.json();
      const items1 = data1?.Items;
      if (items1 && items1.length > 0) {
        const result = extractVerifiedFromRakutenItems(items1, title);
        if (result) {
          console.log(`[Verify] ✅ Stage1 (title+author) VERIFIED: "${title}" → "${result.verifiedTitle}"`);
          return result;
        }
      }
      console.log(`[Verify] Stage1 (title+author): no match for "${title}" by ${author}`);
    } else {
      console.log(`[Verify] Stage1 Rakuten HTTP ${res1.status} for "${title}"`);
    }
  } catch (e) {
    console.warn(`[Verify] Stage1 Rakuten error for "${title}":`, e);
  }

  // ── Stage 2: タイトルのみで検索（著者名フォーマット不一致の救済） ──
  try {
    const url2 = `${baseUrl}&title=${encodeURIComponent(title)}`;
    const res2 = await rateLimitedRakutenFetch(url2);
    if (res2.ok) {
      const data2 = await res2.json();
      const items2 = data2?.Items;
      if (items2 && items2.length > 0) {
        const result = extractVerifiedFromRakutenItems(items2, title);
        if (result) {
          console.log(`[Verify] ✅ Stage2 (title-only) VERIFIED: "${title}" → "${result.verifiedTitle}"`);
          return result;
        }
      }
    }
    console.log(`[Verify] Stage2 (title-only): no match for "${title}"`);
  } catch (e) {
    console.warn(`[Verify] Stage2 Rakuten error for "${title}":`, e);
  }

  console.log(`[Verify] ❌ FINAL: "${title}" by ${author} — not found in Rakuten`);
  return empty;
}

/**
 * 楽天API逐次検証（レートリミット対応: 1req/sec）
 * AIの推薦順で1冊ずつ検証し、needed冊揃った時点で即終了（真の早期リターン）。
 * 残りの未検証候補はpendingCandidatesとして返す。
 */
async function verifyBooksSequentially(
  candidates: BookFromAI[],
  needed: number
): Promise<{ verified: BookResult[]; remaining: BookFromAI[] }> {
  const verified: BookResult[] = [];
  let lastCheckedIdx = -1;

  for (let i = 0; i < candidates.length; i++) {
    if (verified.length >= needed) break;
    lastCheckedIdx = i;

    // レートリミットはrateLimitedRakutenFetchが自動制御
    const book = candidates[i];
    const result = await verifyWithRakuten(book.title, book.author);
    if (!result.verified || !result.coverUrl) {
      console.log(`[Verify] ❌ #${i + 1} "${book.title}" — not verified`);
      continue;
    }

    const finalTitle = result.verifiedTitle || book.title;
    const finalAuthor = result.verifiedAuthor || book.author;

    verified.push({
      ...book,
      title: finalTitle,
      author: finalAuthor,
      thumbnail: result.coverUrl,
      amazonUrl: generateAmazonUrl(finalTitle, finalAuthor),
      rakutenUrl: result.rakutenUrl || generateRakutenUrl(finalTitle, finalAuthor),
    });
    console.log(`[Verify] ✅ ${verified.length}/${needed} verified: "${finalTitle}"`);
  }

  // 未検証の残り候補をフロントに返す（次のバッチで使用）
  const remaining = candidates.slice(lastCheckedIdx + 1);
  return { verified, remaining };
}


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

    // ──────────────────────────────────────────────
    // Mode A: pendingCandidates あり → AIスキップ、残り候補の検証のみ
    // Mode B: pendingCandidates なし → AI選書 + 楽天検証
    // ──────────────────────────────────────────────
    let candidates: BookFromAI[];
    let fragments: string[] = [];

    if (pendingCandidates && Array.isArray(pendingCandidates) && pendingCandidates.length > 0) {
      // ── Mode A: AI呼び出しスキップ（バッチ2/3用。超高速） ──
      console.log(`[Recommend] Mode A: Using ${pendingCandidates.length} pending candidates (AI skipped)`);
      candidates = pendingCandidates;
    } else {
      // ── Mode B: AI選書 + 楽天検証（バッチ1用） ──
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
          console.error('Failed to fetch heart profiles:', e);
        }
      }

      // Exclusion list
      let exclusionNote = '';
      if (excludeTitles && Array.isArray(excludeTitles) && excludeTitles.length > 0) {
        exclusionNote = `\n\n【除外する書籍】以下は既に推薦済みです。絶対に重複しないでください：\n${excludeTitles.map((t: string) => `- ${t}`).join('\n')}`;
      }

      const wantFragments = includeFragments !== false;

      const userPrompt = `以下のnote記事を深く読み解き、この筆者が「今まさに読むべき一冊」を${AI_REQUEST_COUNT}冊推薦してください。
候補は多めに出してください。この中から楽天ブックスAPIで実在確認できたものだけを採用します。

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

      // Parse JSON
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
        console.error('[Recommend] JSON parse failed. Raw text:', rawText.slice(0, 500));
        throw new Error('AIの応答を解析できませんでした');
      }
      candidates = aiResult.books || [];
      fragments = wantFragments ? (aiResult.fragments || []) : [];
      console.log(`[Recommend] Mode B: AI returned ${candidates.length} candidates`);
    }

    // ──────────────────────────────────────────────
    // 楽天API逐次検証 — 3冊揃ったら即レスポンス
    // 残りの未検証候補はpendingCandidatesとして返す
    // ──────────────────────────────────────────────
    const { verified, remaining } = await verifyBooksSequentially(candidates, BOOK_COUNT);

    console.log(`[Result] 検証通過 ${verified.length}冊 / 必要 ${BOOK_COUNT}冊 | 未検証残り ${remaining.length}冊`);

    if (verified.length === 0) {
      console.error('[Verify] No books passed Rakuten verification');
      return NextResponse.json(
        { error: 'RECOMMEND_FAILED', message: 'ごめんなさい、条件に合う本が見つかりませんでした。もう一度お試しください。' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      books: verified,
      fragments,
      // 未検証の残り候補をフロントに返す → 次のバッチでAIコール不要
      pendingCandidates: remaining,
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

function generateRakutenUrl(title: string, author: string): string {
  const query = encodeURIComponent(`${title} ${author}`);
  const affId = process.env.RAKUTEN_AFFILIATE_ID || '';
  const base = `https://books.rakuten.co.jp/search?sv=30&b=1&g=001&sitem=${query}`;
  return affId ? `${base}&aid=${affId}` : base;
}
