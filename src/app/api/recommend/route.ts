import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `あなたは、人の心を深く読み解く天才的な編集者であり、文学の海を熟知するキュレーターです。

## ミッション
ユーザーが書いたnote本文を徹底的に読み込み、その人の立場、悩み、課題感、そして隠された願望を行間から深く推論してください。
その推論に基づき、「この人が今まさに読むべき運命の1冊」を9冊分リストアップしてください。

## 推薦の鉄則
1. **既知すぎない名著・良書を選ぶ**：定番中の定番（7つの習慣、嫌われる勇気 等）は避け、実在する具体的な書籍を推薦する
2. **実在する書籍のみ**：架空の本は絶対に推薦しない。タイトルと著者名は正確に
3. **9冊すべてが異なる切り口**：同じジャンル・同じ著者に偏らない
4. **noteの内容に深く紐づく**：汎用的なおすすめではなく、この人のこのnoteだからこそ選ばれた本であること

## 出力JSON（9冊分の配列）
{
  "books": [
    {
      "title": "正確な書籍タイトル",
      "author": "著者名",
      "label": "noteから導かれる一言オリジナルラベル（例: '立ち止まる勇気'）。固定カテゴリではなく、noteの内容に即した言葉",
      "headline": "なぜおすすめなのかのタイトル（例: '足がとまるあなたに勇気を与えてくれる1冊'）",
      "oneliner": "20〜40字のヒトコト推薦（キャッチーで引きのある一文）",
      "summary": "客観的な書籍概要（100〜150字。この本がどんな本なのかを簡潔に）",
      "letter": "エモーショナルな手紙形式の推薦文（200〜400字）。必ずnote本文の具体的な言葉を引用し、「あなたの『〇〇』という言葉から、こんな葛藤を感じました。だからこそ…」と1対1で語りかける構成にする。編集者が深夜に万年筆で書いた手紙のような温度感で。"
    }
  ],
  "fragments": ["note本文から印象的な一節を5〜8つ抽出（待機画面で表示するため）。各20〜60字程度"]
}`;

interface BookFromAI {
  title: string;
  author: string;
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
    const { body: noteBody, title: noteTitle } = await req.json();

    if (!noteBody || typeof noteBody !== 'string' || noteBody.trim().length < 50) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: '本文が短すぎます。もう少し長い本文を入力してください。' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SERVER_CONFIG_ERROR', message: 'AI設定エラーです。' },
        { status: 500 }
      );
    }

    // Phase 1: Deep profiling + book recommendation via LLM
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.9,
        maxOutputTokens: 65536,
      },
    });

    const userPrompt = `以下のnote記事を深く読み込み、この著者の立場・悩み・課題感・隠れた願望を推論した上で、「運命の9冊」を推薦してください。

━━━━━━━━━━━━━━━━
■ note記事タイトル: ${noteTitle || '（タイトルなし）'}
━━━━━━━━━━━━━━━━
${noteBody.trim().slice(0, 8000)}
━━━━━━━━━━━━━━━━

【重要な指示】
- 9冊すべて実在する書籍であること（架空の本は禁止）
- 和書・洋書（翻訳書）いずれも可
- 定番すぎるベストセラーは避け、知る人ぞ知る名著・良書を優先
- note記事の具体的な言葉を引用した手紙形式の推薦文を各本に書く
- fragmentsはnote本文から印象的な一節を5〜8つ抽出する

指定されたJSON形式のみを出力してください。`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
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

    // Phase 2: Fetch book info from Google Books API
    const enrichedBooks: BookResult[] = await Promise.all(
      books.map(async (book) => {
        const bookInfo = await searchGoogleBooks(book.title, book.author);
        return {
          ...book,
          thumbnail: bookInfo.thumbnail || '/default-cover.png',
          amazonUrl: generateAmazonUrl(book.title, book.author),
        };
      })
    );

    return NextResponse.json({
      books: enrichedBooks,
      fragments,
    });
  } catch (error: unknown) {
    console.error('Recommend API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'RECOMMEND_FAILED', message: `推薦に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}

async function searchGoogleBooks(title: string, author: string): Promise<{ thumbnail: string }> {
  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1&langRestrict=ja&printType=books`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) return { thumbnail: '' };

    const data = await res.json();
    const item = data.items?.[0];

    if (!item?.volumeInfo?.imageLinks) return { thumbnail: '' };

    // Get the highest quality thumbnail available
    const links = item.volumeInfo.imageLinks;
    let thumbnail = links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail || '';

    // Convert to HTTPS and get larger image
    if (thumbnail) {
      thumbnail = thumbnail.replace(/^http:/, 'https:');
      // Remove zoom parameter and set to higher quality
      thumbnail = thumbnail.replace(/&zoom=\d+/, '');
      // Try to get larger image by modifying the URL
      if (!thumbnail.includes('zoom=')) {
        thumbnail += '&zoom=2';
      }
    }

    return { thumbnail };
  } catch {
    return { thumbnail: '' };
  }
}

function generateAmazonUrl(title: string, author: string): string {
  const query = encodeURIComponent(`${title} ${author}`);
  const tag = process.env.AMAZON_ASSOCIATE_TAG || 'notememo-22';
  return `https://www.amazon.co.jp/s?k=${query}&tag=${tag}`;
}
