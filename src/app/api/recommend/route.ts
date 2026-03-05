import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAuthClient } from '@/lib/supabase';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

function buildSystemPrompt(count: number) {
  return `あなたは、ユーザーの言葉を深く愛するプロの編集者です。

## ミッション
ユーザーが書いたnote本文をじっくり読み込み、その人の立場、悩み、課題感、そしてまだ言葉にできていない願いを行間から丁寧に読み解いてください。
その上で、「この人が今まさに読むべき一冊」を${count}冊分リストアップしてください。

## 推薦の鉄則
1. **既知すぎない名著・良書を選ぶ**：定番中の定番（7つの習慣、嫌われる勇気 等）は避け、実在する具体的な書籍を推薦する
2. **実在する書籍のみ**：架空の本は絶対に推薦しない。タイトルと著者名は正確に
3. **${count}冊すべてが異なる切り口**：同じジャンル・同じ著者に偏らない
4. **noteの内容に深く紐づく**：汎用的なおすすめではなく、この人のこのnoteだからこそ選ばれた本であること
5. **ISBN-13は必ず記載する**：実在する書籍のISBN-13コードを正確に記載する。ISBNがわからない場合でも、最も可能性の高いISBN-13を推測して記載する

## 出力JSON（${count}冊分の配列）
{
  "books": [
    {
      "title": "正確な書籍タイトル",
      "author": "著者名",
      "isbn": "ISBN-13コード（13桁の数字。例: 9784478025819）。必ず記載する",
      "label": "noteから導かれる一言オリジナルラベル（例: '足がとまるあなたへ'、'そっと勇気をくれる1冊'）",
      "headline": "なぜおすすめなのかのタイトル",
      "oneliner": "20〜40字のヒトコト推薦（キャッチーで引きのある一文）",
      "summary": "客観的な書籍概要（100〜150字）",
      "letter": "手紙形式の推薦文（200〜400字）。必ずユーザーのnote本文の具体的な言葉を引用し、体温を感じる文章にしてください。"
    }
  ],
  "fragments": ["note本文から印象的な一節を5〜8つ抽出。各20〜60字程度"]
}`;
}

interface BookFromAI {
  title: string;
  author: string;
  isbn?: string;
  label: string;
  headline: string;
  oneliner: string;
  summary: string;
  letter: string;
}

interface BookResult extends BookFromAI {
  thumbnail: string;
  amazonUrl: string;
}

export async function POST(req: Request) {
  try {
    // Check request body size (max 16KB)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 16384) {
      return NextResponse.json(
        { error: 'PAYLOAD_TOO_LARGE', message: 'リクエストが大きすぎます。' },
        { status: 413 }
      );
    }

    // Rate limit: 6 requests per minute per IP (now two-phase, so doubled)
    const ip = getClientIp(req);
    const { success: rateLimitOk } = rateLimit(`recommend:${ip}`, { maxRequests: 6, windowMs: 60_000 });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', message: '少しお時間をおいてから、もう一度お試しください。' },
        { status: 429 }
      );
    }

    const { body: noteBody, title: noteTitle, phase, excludeTitles } = await req.json();

    if (!noteBody || typeof noteBody !== 'string' || noteBody.trim().length < 50) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'もう少しだけ文章を教えてください（50文字以上お願いします）' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SERVER_CONFIG_ERROR', message: '申し訳ありません、ただいま準備中です。しばらくしてからもう一度お試しください。' },
        { status: 500 }
      );
    }

    // Determine count based on phase
    const isPhase2 = phase === 2;
    const bookCount = isPhase2 ? 6 : 3;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.9,
        maxOutputTokens: isPhase2 ? 65536 : 16384,
      },
    });

    // Fetch past heart profiles for returning users (continuity counseling)
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
            pastContext = `\n\n## あなたはこのユーザーの専属編集者です\nこれまでの対話から蓄積された「心のカルテ」があります。手紙の冒頭で、過去と今回の変化や時間経過に優しく触れてください。\n\n### 過去の心のカルテ（新しい順）\n${profiles.map((p, i) => `[${i + 1}] ${new Date(p.created_at).toLocaleDateString('ja-JP')}:\n${p.summary}`).join('\n\n')}`;
          }
        }
      } catch (e) {
        console.error('Failed to fetch heart profiles:', e);
      }
    }

    // Build exclusion instruction for phase 2
    let exclusionNote = '';
    if (isPhase2 && excludeTitles && Array.isArray(excludeTitles) && excludeTitles.length > 0) {
      exclusionNote = `\n\n【除外する書籍】\n以下の書籍はフェーズ1で既に推薦済みです。絶対に重複しないでください：\n${excludeTitles.map((t: string) => `- ${t}`).join('\n')}`;
    }

    const userPrompt = `以下のnote記事をじっくり読み込み、この著者の立場・悩み・課題感・まだ言葉にできていない願いを読み解いた上で、「今読んでほしい一冊」を${bookCount}冊推薦してください。

━━━━━━━━━━━━━━━━
■ note記事タイトル: ${noteTitle || '（タイトルなし）'}
━━━━━━━━━━━━━━━━
${noteBody.trim().slice(0, 8000)}
━━━━━━━━━━━━━━━━

【重要な指示】
- ${bookCount}冊すべて実在する書籍であること（架空の本は禁止）
- 和書・洋書（翻訳書）いずれも可
- 定番すぎるベストセラーは避け、知る人ぞ知る名著・良書を優先
- note記事の具体的な言葉を引用した手紙形式の推薦文を各本に書く。「AI」「推論」「分析」といった機械的な言葉は絶対に使わない
${isPhase2 ? '' : '- fragmentsはnote本文から印象的な一節を5〜8つ抽出する'}
- isbn: 各書籍のISBN-13コードを必ず記載する。正確なISBNがわかる場合はそれを、わからない場合は最も可能性の高いISBN-13を記載する${exclusionNote}

指定されたJSON形式のみを出力してください。`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { role: 'model', parts: [{ text: buildSystemPrompt(bookCount) + pastContext }] },
    });

    const rawText = result.response.text();

    let jsonText = rawText;
    const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      jsonText = fenceMatch[1];
    }

    const aiResult = JSON.parse(jsonText.trim());
    const books: BookFromAI[] = aiResult.books || [];
    const fragments: string[] = aiResult.fragments || [];

    // Build results — thumbnail will be loaded client-side from NDL
    const enrichedBooks: BookResult[] = books.map((book) => {
      // Clean ISBN: ensure 13 digits only
      const cleanIsbn = (book.isbn || '').replace(/[^0-9]/g, '');
      const validIsbn = cleanIsbn.length === 13 ? cleanIsbn : '';

      return {
        ...book,
        isbn: validIsbn,
        // Thumbnail: use NDL as primary (loaded client-side), empty string means use placeholder
        thumbnail: validIsbn ? `https://ndlsearch.ndl.go.jp/thumbnail/${validIsbn}.jpg` : '',
        amazonUrl: generateAmazonUrl(book.title, book.author),
      };
    });

    return NextResponse.json({
      books: enrichedBooks,
      fragments: isPhase2 ? [] : fragments,
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
