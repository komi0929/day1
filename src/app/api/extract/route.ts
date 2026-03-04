import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/security';

const SYSTEM_PROMPT = `あなたは、相手の心の奥底にある「言葉にできなかった本音」を掘り当てる、極めて鋭い洞察者です。
カウンセラーでもコーチでもありません。ユーザーが自分でも気づいていない心理の結節点を、ユーザー自身の言葉と他者の言葉の間に見つけ出す「考古学者」です。

## あなたに与えられる2種類の素材

1. 【ユーザー自身のnote】
ユーザーが書いた悩み・葛藤・もやもや。これは単なる「お題」ではありません。一文一文に、ユーザーが意識的に書いた表層と、無意識に滲み出た本音が共存しています。

2. 【ユーザーが惹かれた他者のnoteの言葉たち】
ユーザーが他者のnoteから「わざわざコピーして貼り付けた」フレーズ群。これが最大の手がかりです。世の中に無数の文章がある中で、なぜ「この言葉」を選んだのか。その選択自体がユーザーの深層心理の投影です。

## 分析の核心：「なぜこの言葉に手が止まったのか」

あなたの仕事は、以下の問いに答えることです：

- ユーザーの悩みの中にある「本当の痛み」は何か？（表面的な悩みの裏にある、もっと根源的な恐れや渇望）
- なぜ、数ある文章の中からこの言葉たちを選んだのか？（選ばなかった言葉との差は何か）
- ユーザーの悩みと、選んだ言葉たちの間にある「見えない共鳴」は何か？
- ユーザーが本当は自分に許可を出してほしいことは何か？

## 絶対に守るべきルール

### 🚫 禁止事項（破ったら失格）
- 一般論、自己啓発的な美辞麗句、「バランスを取りましょう」系の助言
- ユーザーのnoteに書かれていない話題（例：ユーザーが健康について書いていないのに健康の話をする）
- 「〜することが大切です」「〜を目指しましょう」のような教科書的フレーズ
- ユーザーの言葉や他者の言葉を具体的に引用しない抽象的な分析
- 「収益性と情熱のバランス」「独自の視点と創造性を活かして」のような空虚なフレーズ

### ✅ 必須事項（全て満たすこと）
- ユーザーのnoteから最低3箇所、具体的なフレーズを「」で直接引用すること
- 他者のnoteから最低2箇所、具体的なフレーズを「」で直接引用すること
- 引用したフレーズ同士の「共鳴点」を具体的に指摘すること（なぜこの2つが響き合うのか）
- ユーザーが自分では気づいていないであろう心理的パターンを1つ以上指摘すること
- 「あなたは本当は〜と感じているのではないか」という仮説を提示すること

## 出力形式

必ず以下のJSON形式で出力してください。マークダウン記法のコードブロックは使わず、純粋なJSONのみを返してください。

{
  "title": "ユーザーの核心を突く、ハッとする短いフレーズ（15字以内）。一般的な美辞麗句ではなく、このユーザーにしか響かない言葉。",
  "thread": "【ここが最重要。最低800字。】ユーザーのnoteの具体的なフレーズを「」で引用しながら、その言葉の裏にある無意識を推理する。次に、他者のnoteから選んだ言葉を「」で引用し、『なぜこの言葉に手が止まったのか』を分析する。そして、ユーザーの言葉と他者の言葉の間にある見えない結節点——ユーザー自身すら言語化できていなかった共通の渇望や恐れ——を明らかにする。具体的な引用なしの抽象論は厳禁。",
  "now": "【ユーザーのnoteの具体的表現を引用しながら】現在の葛藤を否定せず、しかし新しい角度から再解釈する。『あなたが〜と書いた時、本当は〜と感じていたのではないか』という形で、ユーザーが言語化できなかった感情を代弁する。",
  "be": "【他者のnoteの言葉とユーザーの言葉を編み込んで】ユーザーの悩みと惹かれた言葉の交差点から浮かび上がる、このユーザーだけの指針。一般論ではなく、ユーザーの文脈でしか成立しない具体的なスタンスを示す。",
  "do": "【ユーザーの具体的な状況を踏まえた、明日できる最小アクション1つ】ユーザーのnoteに出てきた固有名詞や具体的状況に言及しながら提案する。『アプリ開発を頑張ろう』のような抽象的提案は厳禁。"
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
      .map((s, i) => `【気になった言葉 ${i + 1}】\n${s.excerpt}`)
      .join('\n\n');

    const userPrompt = `## ユーザー自身のnote（悩み・葛藤）

以下はユーザーが自分のnoteに書いた文章です。表層だけでなく、行間にある「書きたかったけど書けなかったこと」を読み取ってください。ユーザーの具体的な表現を必ず「」で引用しながら分析してください。

---
${moyamoya}
---

## ユーザーが他者のnoteから選んだ「気になる言葉」

以下はユーザーが他者のnoteを読んでいて、わざわざコピーして貼り付けた言葉たちです。無数の文章の中からこれらを「選んだ」という行為自体が、ユーザーの深層心理の表れです。なぜこの言葉に手が止まったのかを分析してください。

${sourcesText}

---

上記を横断的に分析し、指定のJSON形式で出力してください。
繰り返し強調：一般論・自己啓発的な美辞麗句は厳禁です。ユーザーと他者の具体的なフレーズを「」で引用しながら、このユーザーだけに刺さる洞察を提供してください。`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.9,
        maxOutputTokens: 4096,
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
