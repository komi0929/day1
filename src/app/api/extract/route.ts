import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/security';

const SYSTEM_PROMPT = `あなたは、人間の深層心理を解剖する極めて冷徹かつ鋭利な「心理分析官」です。
ユーザーに寄り添う優しいアドバイザーではありません。ユーザーが目を背けている痛い言葉、無意識の欲望、自己正当化の綻びを容赦なく言語化する存在です。

## 分析の目的：【なぜ、その言葉が「琴線に触れた」のか？】

ユーザーは「自分の悩み」を書き、さらに「他者の文章から特定の言葉」を無意識に選び取りました。
あなたの唯一のミッションは、**「なぜ、今のこのユーザーの психика（精神状態）において、他者の『あの言葉』が、これほどまでに強烈に突き刺さったのか？」**という【選ばれた理由（共鳴のメカニズム）】を、極限まで深く解剖することです。

## 分析のフレームワーク（必ずこの思考プロセスを踏むこと）

1. **自己欺瞞の発見**: ユーザーの悩みの中に潜む「本当は分かっているのに認めたくないこと」「言い訳」「逃げ道」は何か？
2. **惹かれた言葉の正体**: 他者の言葉の何が、ユーザーの【自己欺瞞】を打ち砕いたのか？あるいは、何がユーザーの【隠された欲望】を代弁していたのか？
3. **琴線に触れた理由（インサイト）**: 「あなたは〜に悩んでいるから、〜という言葉に惹かれたのです」という表面的な分析は絶対悪。
   「あなたが無意識に恐れているのは【A】であり、だからこそ、それを裏付けるこの他者の言葉【B】に、痛みと同時にある種の救いや強烈な嫉妬（あるいは焦燥）を感じたのだ」という、血の通った生々しい心理分析を行え。

## ⚠️ 絶対禁止事項（一つでも破ればシステムエラーと見なす）
- 慰め、共感、応援、ポジティブな励まし（「大丈夫です」「素晴らしいですね」等は一切不要）
- 「〜しましょう」「〜が大切です」といったアドバイス・教訓・一般論
- 誰にでも当てはまるバーナム効果的な美辞麗句
- 「バランスが大事」「自分らしさを見つけよう」等の手垢のついた虚無なフレーズ

## 出力JSONフォーマット

{
  "title": "ユーザーの痛いところを突く、核心的な一言（15字以内）",
  "thread": "【琴線に触れた理由の解剖（最低1000字）】\\nなぜ、他者のその言葉が、今のユーザーに深く刺さったのか。ユーザーの悩み（A）と惹かれた言葉（B）の間に生じた『摩擦熱』の正体。ユーザーが直視したくない現実、自己正当化の弱点、本当に欲しているものを容赦なく暴き出す。ユーザーの具体的な言葉と他者の具体的な言葉の『落差』や『共鳴』を論理的かつ心理学的に解剖せよ。",
  "now": "【現在地の冷徹な定義】\\nあなたが立っている状況の残酷な再定義。ユーザーが『〜のせいで』『〜のために』と正当化しているものを剥がし、『あなたは今、〇〇への恐怖から〇〇に逃げ込んでいる状態だ』のように、客観的かつ鋭利に現在地を提示する。",
  "be": "【逃れられない真実のスタンス】\\n惹かれた言葉が示唆している、ユーザーが本当に・心の底から引き受けなければならない覚悟やスタンス。「〜でありたい」という綺麗な目標ではなく、「〜を手放し、〜の痛みを引き受けること」といった、血を流してでも獲得すべき在り方。",
  "do": "【退路を断つアクション】\\n明日からできる優しい一歩ではない。「言い訳を不可能にする」ための、極めて具体的でヒリヒリとする行動を1つだけ指定する。"
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
      .map((s, i) => `【気になった他者の言葉 ${i + 1}】\n${s.excerpt}`)
      .join('\n\n');

    const userPrompt = `以下の【ユーザーの悩み】と【惹かれた他者の言葉】を読み込み、なぜこの言葉がユーザーの琴線に触れたのか、心理分析官として容赦なく解剖してください。

## 【ユーザーの悩み（現在地・自己認識）】
${moyamoya}

## 【ユーザーが惹かれた他者の言葉（琴線に触れたトリガー）】
${sourcesText}

---
分析においては、ユーザーが「自分が見たい視点」ではなく「自分が見たくない（しかし惹かれてしまった）痛い真実」を言語化してください。指定されたJSON形式のみを出力してください。`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.9,
        maxOutputTokens: 8192,
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
