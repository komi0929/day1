import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/security';

const SYSTEM_PROMPT = `あなたは、ユーザーの深層心理を解き明かす「インサイト・エクストラクター」です。

ユーザーの「もやもや」と、「複数の他者の言葉（note抜粋）」を横断的に分析し、以下の構造で出力してください。一般論は避け、なぜこれらの言葉に惹かれたのか、深層心理を突く「アハ体験」を提供すること。

必ず以下のJSON形式で出力してください。マークダウン記法のコードブロックは使わず、純粋なJSONのみを返してください。

{
  "title": "今回の気づきを象徴する、詩的で印象的なタイトル（15字以内）",
  "thread": "なぜ一見バラバラなこれらの言葉に惹かれたのか。根底にある「隠れた願い・結節点」の推理と明示。ユーザーが自分でも気づいていなかった深層の欲求を言語化する。",
  "now": "もやもやを否定せず、健全な葛藤として客観的に再定義する。「あなたは今、〜という分岐点にいる」のような形で、現在地を肯定的に捉え直す。",
  "be": "引用した知見を編み込んだ、目指すべき未来のスタンス。「〜でありたい」という北極星を示す。",
  "do": "Beに向かうための、具体的で実行可能な最小アクション。明日すぐできる一歩を提示する。"
}`;

interface NoteSource {
  url: string;
  note_title: string;
  excerpt: string;
}

export async function POST(req: Request) {
  // 認証チェック
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { moyamoya, sources } = body as {
      moyamoya: string;
      sources: NoteSource[];
    };

    // バリデーション
    if (!moyamoya || typeof moyamoya !== 'string' || moyamoya.trim().length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: '「もやもや」を入力してください。' },
        { status: 400 }
      );
    }

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'noteの引用を最低1つ追加してください。' },
        { status: 400 }
      );
    }

    if (moyamoya.length > 2000) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: '「もやもや」は2000文字以内で入力してください。' },
        { status: 400 }
      );
    }

    for (const s of sources) {
      if (!s.excerpt || s.excerpt.trim().length === 0) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: '抜粋テキストが空のnoteがあります。' },
          { status: 400 }
        );
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SERVER_CONFIG_ERROR', message: 'AI設定エラーです。' },
        { status: 500 }
      );
    }

    const sourcesText = sources
      .map((s, i) => `【note ${i + 1}】${s.note_title ? `「${s.note_title}」` : '(無題)'}\n${s.excerpt}`)
      .join('\n\n');

    const userPrompt = `## ユーザーの「もやもや」
${moyamoya}

## 惹かれた他者の言葉たち
${sourcesText}

上記を横断的に分析し、指定のJSON形式で出力してください。`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.8,
      },
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
    });

    const text = result.response.text();
    const insight = JSON.parse(text);

    return NextResponse.json({ insight });
  } catch (error: unknown) {
    console.error('Extract API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'EXTRACT_FAILED', message: `分析に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
