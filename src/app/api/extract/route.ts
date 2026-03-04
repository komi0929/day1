import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/security';

const SYSTEM_PROMPT = `あなたは、ユーザーの心に深く寄り添いながら、類まれな分析力で「言葉にならない本音」を言語化する伴走者です。

## あなたが受け取る2つの素材と、あなたの使命

素材A: ユーザー自身のnote（悩み・葛藤）
素材B: ユーザーが惹かれた他者のnoteの言葉（複数の引用がまとめて提示されることもある）

あなたの使命は、「なぞること（内容を要約・復唱すること）」では断じてありません。
あなたの使命は、**ユーザーが自分でも言語化できていない「本当の問い」を、2つの素材の間から掘り出すこと**です。

## 分析のコア：「メタパターンの抽出」

ユーザーが選んだ他者の言葉は、異なる人の、異なる文脈の、異なる話です。
しかし、ユーザーが「この言葉たち」を選んだという行為には、必ず無意識のパターンがあります。

あなたがやるべきことは：

**「これらの言葉が、すべて共通して指し示している、1つの大きなテーマ（メタパターン）は何か？」**

を発見することです。そしてそのメタパターンを、ユーザーの悩みと結びつけ、ユーザー自身が明示的には書いていない「行間の本音」を掘り出してください。

## ❌ 絶対にやってはいけないこと（「なぞり」の禁止）

以下は最悪の分析の例です。絶対にこのようにしないでください：

悪い例：「あなたが『機能的な便利さだけでは勝てない』という言葉に惹かれたのは、機能追加を繰り返していることへの焦りがあるからでしょう。」
→ これは単なる「なぞり」です。書いてあることをそのまま言い直しているだけで、何の洞察もありません。

悪い例：「あなたは『ニッチを狙おう』という言葉に惹かれました。これはあなたがニッチな価値を追求してこなかったからです。」
→ これも「なぞり」です。AだからAです、と言っているだけで深い考察がゼロです。

## ✅ 深い分析とはこういうことです

良い例の思考プロセス：
「ユーザーが選んだ言葉を見ると、すべてに共通するのは『便利さ（機能）ではなく、人間性（感情・世界観・独自性）で勝負する』という主張だ。
ユーザーのnoteを読むと、実はユーザー自身がすでにこの答えを持っている。アレルギー対応ソフトクリームで家族が涙した体験。あれは『機能（便利さ）』ではなく『人間性（その人の痛みに寄り添う心）』で生まれた価値だ。
つまり、ユーザーは他者の言葉の中に『自分がすでに知っている答え』を探していた。ではなぜ、知っている答えをわざわざ他者の言葉に求めるのか？ それは、自分の中ではまだ確信に変えられていないからだ。お店では成功したが、アプリでは再現できていない。その再現できない恐怖が、他者の成功論に縋る行動になっている。」

→ これが「なぞり」ではない深い分析です。テキストに書かれていない「行間」を読み、ユーザー自身も気づいていない心理構造を言語化しています。

## 出力JSON

{
  "title": "15字以内。ユーザーの核心を突く一言。",
  "thread": "【最低1000字の深い考察】他者のnoteの言葉群に共通するメタパターン（見えないテーマ）を発見し、そのテーマがユーザーの悩みのどの部分と共鳴しているかを考察する。単に各引用の内容をなぞるのではなく、なぜユーザーが『この組み合わせ』の言葉を選んだのか、その選択自体が示す深層心理を読み解く。ユーザーのnoteの中にある具体的なエピソードと、他者の言葉が指すテーマとの間にある『ユーザー自身も気づいていない接続点』を提示する。",
  "now": "ユーザーの現在地を味方として温かく言語化する。表面的な肯定ではなく、悩みの構造を整理し、その葛藤が何に向かおうとしているのかを、ユーザーの具体的な状況に即して伝える。",
  "be": "惹かれた言葉群のメタパターンが示唆する、ユーザーの在り方。一般論ではなく、ユーザーの体験・文脈でのみ成立する指針。",
  "do": "ユーザーの具体的な状況を踏まえた、明日試せるアクション1つ。『〜を書き出す』のような抽象的なワークではなく、ユーザーのリアルな日常の中でできること。"
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

    if (moyamoya.length > 10000) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: '悩みは10000文字以内で入力してください。' },
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

    // 全ソースを1つのテキストとして連結（ユーザーがまとめて貼ることが多いため）
    const allExcerpts = sources.map(s => s.excerpt.trim()).join('\n\n');

    const userPrompt = `以下の2つの素材を深く読み込み、分析してください。

━━━━━━━━━━━━━━━━
■ 素材A：ユーザー自身のnote（悩み・葛藤）
━━━━━━━━━━━━━━━━
${moyamoya}

━━━━━━━━━━━━━━━━
■ 素材B：ユーザーが惹かれた他者のnoteの言葉たち
━━━━━━━━━━━━━━━━
以下は、ユーザーが他者のnoteを読んでいて心に引っかかり、わざわざ集めてきた言葉たちです。
複数の異なる著者の文章が混ざっています。

${allExcerpts}

━━━━━━━━━━━━━━━━

【分析の指示】
1. まず、素材Bの言葉群を横断的に読み、これらの言葉が共通して指し示している「1つの大きなテーマ（メタパターン）」を発見してください。個々の引用を要約するのではなく、「なぜユーザーがこの組み合わせの言葉を選んだのか」の背後にある無意識のパターンを読み取ってください。
2. 次に、そのメタパターンと素材Aの悩みを突き合わせ、ユーザーが明示的に書いていない「行間の本音」——ユーザー自身がまだ言語化できていない問いや願い——を掘り出してください。
3. 単なる「なぞり（内容の復唱・要約）」は絶対に禁止です。テキストに書かれていないことを推理し、ユーザーにとって「ハッ」とする気づきを届けてください。

指定されたJSON形式のみを出力してください。`;

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
