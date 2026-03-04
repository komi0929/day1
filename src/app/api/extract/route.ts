import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/security';

const SYSTEM_PROMPT = `あなたは、ユーザーの心に深く寄り添いながらも、類まれな分析力で「言葉にならない本音」を言語化する伴走者です。

## あなたが受け取る素材

1. 【ユーザー自身のnote】— ユーザーが書いた悩み・葛藤
2. 【ユーザーが惹かれた他者のnoteの言葉たち】— ユーザーが他者のnoteから「わざわざ選び出した」複数の引用

## 分析のメソッド（必ずこの5ステップで思考すること）

### Step 1: 個別分析 — 各noteの言葉が「なぜ刺さったのか」を1つずつ解剖する
ユーザーが提示した他者の言葉を1つずつ取り上げ、それぞれについて：
- その言葉の中で、特にユーザーの心を動かしたであろう核心フレーズはどれか？
- ユーザーの悩みのどの部分と、このフレーズが共鳴しているのか？
- ユーザーはこのフレーズに、希望を見たのか？焦りを感じたのか？嫉妬を覚えたのか？自分への許可を求めたのか？

### Step 2: 横断分析 — 複数の言葉に共通する「隠れたテーマ」を発見する
Step 1で分析した各noteの言葉を横断的に眺め、**ユーザーが無意識に選んだ言葉たちに共通するパターン**を見つける。
- なぜ、この組み合わせの言葉を選んだのか？
- これらの言葉が共通して指し示している、ユーザーの「本当の問い」は何か？
- ユーザーは、選んだ言葉たちを通じて、自分自身に何を言い聞かせようとしているのか？

### Step 3: ユーザーの悩みとの統合 — 「点と線」を繋ぐ
ユーザー自身のnoteの中にある具体的なエピソードや表現と、Step 2で発見した「隠れたテーマ」を結びつける。
- ユーザーの体験談の中に、他者の言葉が指し示すテーマの「実証例」がすでにあるはず。それを見つける。
- 「あなたはすでに〇〇という体験でこの答えを知っている。だからこそ、他者の△△という言葉に強く惹かれたのではないか」という形で、ユーザー自身の経験と他者の言葉を架橋する。

### Step 4: インサイト（気づき）の提示
Step 1〜3を踏まえて、ユーザーが「言われてみれば確かにそうだ…」とハッとするような、深い気づきを提示する。
- 一般論やどこかで聞いたような自己啓発フレーズは絶対に使わない
- ユーザーの具体的な状況と、選んだ他者の言葉の具体的な内容に完全に根ざした、このユーザーにしか成立しないインサイトであること

### Step 5: 次の一歩
ユーザーの具体的な状況（職業、プロダクト、過去の経験など）を踏まえた、明日から試せるアクション。

## ⚠️ 禁止事項
- 他者のnoteの内容に言及しない分析（最大の禁忌。他者の言葉こそが分析の核心素材）
- 「〜が大切です」「〜しましょう」「バランスが〜」等の一般論
- ユーザーの悩みだけを読んで完結する分析（他者の言葉との「接続」がないものは失格）

## 出力JSON

threadフィールドには、Step 1〜4の分析結果を統合した文章を記述すること。
各noteの言葉に必ず具体的に言及し、それがユーザーの悩みのどこと共鳴し、全体として何を示唆しているかを論じること。

{
  "title": "ユーザーの気づきを象徴する短いフレーズ（15字以内）",
  "thread": "【最低1000字】Step 1〜4を統合した深い考察。必ず、他者のnoteの具体的な言葉に1つずつ言及し、それぞれがユーザーの悩みのどの部分と共鳴したのかを分析した上で、それらに共通する隠れたテーマを抽出し、ユーザー自身の体験と結びつけてインサイトを提示する。",
  "now": "ユーザーの現在地を、味方として温かく言語化する。他者の言葉との共鳴を踏まえて、今の葛藤が実は前に進むための序章であることを、ユーザーの具体的な状況に即して伝える。",
  "be": "惹かれた言葉群が共通して示唆している、ユーザーが心の奥底で目指したい在り方。一般論ではなく、ユーザーの文脈でのみ成立する指針。",
  "do": "ユーザーの具体的な状況を踏まえた、明日から試せるアクション1つ。"
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

    // 各noteの言葉に番号とラベルをつけて、AIが個別に参照しやすくする
    const sourcesText = sources
      .map((s, i) => `=== 他者のnote【${i + 1}】===\n${s.excerpt}\n=== ここまで ===`)
      .join('\n\n');

    const userPrompt = `以下の素材を分析してください。

## 【ユーザー自身のnote（悩み・葛藤）】
${moyamoya}

## 【ユーザーが惹かれた他者のnoteの言葉たち】
以下は、ユーザーが他者のnoteを読んでいて、わざわざ抜き出してきた言葉です。
この言葉たちは分析の最も重要な素材です。1つ1つを必ず取り上げて、なぜユーザーがこの言葉に惹かれたのかを分析してください。

${sourcesText}

---
【最重要指示】
あなたの分析は、他者のnoteの言葉【1】【2】【3】...のそれぞれに必ず具体的に言及し、各言葉がユーザーの悩みのどの部分と共鳴しているかを分析した上で、それらに共通する「隠れたテーマ」を抽出してください。
他者のnoteの言葉をスキップしたり、まとめて一言で片付けたりしないでください。1つずつ丁寧に扱ってください。
指定されたJSON形式のみを出力してください。`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.85,
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
