import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/security';

const SYSTEM_PROMPT = `あなたは、ユーザーの深層心理を解き明かす「インサイト・エクストラクター」です。

入力は2種類あります：
1. **【最重要】ユーザー自身のnote（悩み・もやもや）** — これがインサイトの核です。この文章を最も深く、丁寧に、行間まで読み込んでください。表面的な言葉だけでなく、書かれていない感情・葛藤・本当に望んでいることを推理してください。
2. **noteで見つけた気になる言葉** — ユーザーが他者のnoteで心に引っかかった文章群。なぜこれらの言葉に惹かれたのかを分析する材料です。

この2つを横断的に分析し、以下の構造で出力してください。一般論は厳禁。なぜこれらの言葉に惹かれたのか、ユーザー自身すら気づいていない深層心理を突く「アハ体験」を提供すること。

必ず以下のJSON形式で出力してください。マークダウン記法のコードブロックは使わず、純粋なJSONのみを返してください。

{
  "title": "今回の気づきを象徴する、詩的で印象的なタイトル（15字以内）",
  "thread": "【最重要分析】ユーザーの悩み（自分のnote）と、他者のnoteで惹かれた言葉群を横断して見えてくる『隠れた結節点』を推理する。なぜ悩んでいる中でこれらの言葉に惹かれたのか？ 根底にある無意識の願い・欲求を言語化する。ユーザーの悩みの文章を深く読み込み、行間にある感情と、引用された言葉との共鳴点を具体的に指摘すること。",
  "now": "もやもやを否定せず、健全な葛藤として客観的に再定義する。ユーザーの悩みの具体的な表現を引用しながら、「あなたは今、〜という分岐点にいる」のような形で、現在地を肯定的に捉え直す。",
  "be": "ユーザーの悩みと、惹かれた言葉群を編み込んだ、目指すべき未来のスタンス。「〜でありたい」という北極星を、ユーザーの文脈に完全に寄り添った形で示す。",
  "do": "Beに向かうための、具体的で実行可能な最小アクション。明日すぐできる一歩を、ユーザーの状況を踏まえて提示する。"
}`;

interface NoteSource {
  url: string;
  excerpt: string;
}

export async function POST(req: Request) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { moyamoya, sources } = body as {
      moyamoya: string;
      sources: NoteSource[];
    };

    if (!moyamoya || typeof moyamoya !== 'string' || moyamoya.trim().length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: '自分のnote（悩み）を入力してください。' },
        { status: 400 }
      );
    }

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'noteで見つけた気になる言葉を最低1つ追加してください。' },
        { status: 400 }
      );
    }

    if (moyamoya.length > 5000) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: '悩みは5000文字以内で入力してください。' },
        { status: 400 }
      );
    }

    for (const s of sources) {
      if (!s.excerpt || s.excerpt.trim().length === 0) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: '気になる言葉が空の項目があります。' },
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
      .map((s, i) => `【気になる言葉 ${i + 1}】\n${s.excerpt}`)
      .join('\n\n');

    const userPrompt = `## 【最重要：熟読せよ】ユーザー自身のnote（悩み・もやもや）
以下はユーザーが自分のnoteに書いた悩みです。表面的な意味だけでなく、行間に隠された感情・葛藤・本当の望みを読み取ってください。

${moyamoya}

## noteで見つけた気になる言葉たち
以下はユーザーが他者のnoteで心に引っかかった文章群です。なぜこれらに惹かれたのかを、上記の悩みとの関連で分析してください。

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
