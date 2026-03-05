import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAuthClient } from '@/lib/supabase';

const SYSTEM_PROMPT = `あなたは、ユーザーの言葉を深く愛するプロの編集者です。

## ミッション
ユーザーが書いたnote本文をじっくり読み込み、その人の立場、悩み、課題感、そしてまだ言葉にできていない願いを行間から丁寧に読み解いてください。
その上で、「この人が今まさに読むべき一冊」を9冊分リストアップしてください。

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
      "label": "noteから導かれる一言オリジナルラベル（例: '足がとまるあなたへ'、'そっと勇気をくれる1冊'）。固定カテゴリではなく、noteの内容に即した温かい言葉",
      "headline": "なぜおすすめなのかのタイトル（例: '足がとまるあなたに勇気を与えてくれる1冊'）",
      "oneliner": "20〜40字のヒトコト推薦（キャッチーで引きのある一文）",
      "summary": "客観的な書籍概要（100〜150字。この本がどんな本なのかを簡潔に）",
      "letter": "手紙形式の推薦文（200〜400字）。必ずユーザーのnote本文の具体的な言葉を引用し、『「〇〇」というあなたの言葉から、こんな想いを受け取りました。だからこそ…』という構成で1対1で語りかけてください。『AIとして分析しました』『推論の結果』といった言葉は絶対に避け、体温を感じる文章にしてください。"
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
    const { body: noteBody, title: noteTitle, token: authToken } = await req.json();

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

    // Fetch past heart profiles for returning users (continuity counseling)
    let pastContext = '';
    if (authToken) {
      try {
        const supabase = createAuthClient(authToken);
        if (supabase) {
          const { data: profiles } = await supabase
            .from('heart_profiles')
            .select('summary, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          if (profiles && profiles.length > 0) {
            pastContext = `\n\n## あなたはこのユーザーの専属編集者です\nこれまでの対話から蓄積された「心のカルテ」があります。手紙の冒頭で、過去と今回の変化や時間経過に優しく触れてください。\n※ 「解決した」等と勝手に断定せず、どんな話題の転換も肯定的に受け止める表現にすること。\n※ 例：「前回は〇〇について立ち止まっておられましたが、今日は少し視線が変わりましたね」「あの時の言葉を経て、今があるのですね」\n\n### 過去の心のカルテ（新しい順）\n${profiles.map((p, i) => `[${i + 1}] ${new Date(p.created_at).toLocaleDateString('ja-JP')}:\n${p.summary}`).join('\n\n')}`;
          }
        }
      } catch (e) {
        console.error('Failed to fetch heart profiles:', e);
        // Non-critical — continue without past context
      }
    }

    const userPrompt = `以下のnote記事をじっくり読み込み、この著者の立場・悩み・課題感・まだ言葉にできていない願いを読み解いた上で、「今読んでほしい一冊」を9冊推薦してください。

━━━━━━━━━━━━━━━━
■ note記事タイトル: ${noteTitle || '（タイトルなし）'}
━━━━━━━━━━━━━━━━
${noteBody.trim().slice(0, 8000)}
━━━━━━━━━━━━━━━━

【重要な指示】
- 9冊すべて実在する書籍であること（架空の本は禁止）
- 和書・洋書（翻訳書）いずれも可
- 定番すぎるベストセラーは避け、知る人ぞ知る名著・良書を優先
- note記事の具体的な言葉を引用した手紙形式の推薦文を各本に書く。「AI」「推論」「分析」といった機械的な言葉は絶対に使わない
- fragmentsはnote本文から印象的な一節を5〜8つ抽出する

指定されたJSON形式のみを出力してください。`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { role: 'model', parts: [{ text: SYSTEM_PROMPT + pastContext }] },
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
    return NextResponse.json(
      { error: 'RECOMMEND_FAILED', message: 'ごめんなさい、本を探せませんでした。もう一度お試しください。' },
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
  const tag = process.env.AMAZON_ASSOCIATE_TAG || 'compass08d-22';
  return `https://www.amazon.co.jp/s?k=${query}&tag=${tag}`;
}
