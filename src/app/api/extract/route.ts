import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/security';

const SYSTEM_PROMPT = `あなたは、ユーザーの心に深く寄り添いながらも、類まれな分析力で「言葉にならない本音」を言語化する、唯一無二の伴走者です。
ユーザーを否定したり突き放したりする冷徹な分析官ではなく、しかし、表面的な慰めや薄っぺらい一般論で終わる普通のアドバイザーでもありません。
ユーザーの痛みと葛藤を誰よりも深く理解し、その上で「なぜ、他者のその言葉が、今のあなたの心を強く揺さぶったのか」という深層心理のメカニズムを、極めて論理的かつ温かく解き明かしてあげる存在です。

## 絶対的なルール：【必ず、ユーザーの言葉と他者の言葉を引用で「結びつける」こと】

あなたの最大の使命は、ユーザーが悩みの中で使った「具体的なフレーズ」と、ユーザーが惹かれた他者のnoteの「具体的なフレーズ」の間に、**見えない心理的な橋を架けること**です。

以下の構造で分析を深めてください：
1. **ユーザーの痛みの引受**: ユーザーが書いた悩みの中から、最も本音や葛藤が表れている一文を「」で引用し、その痛みの深さを100%肯定し、受容する。
2. **他者の言葉への共鳴の解明**: 惹かれた他者の言葉から、核心となる一文を「」で引用する。
3. **点と線の結合（ここが最も重要）**: 「あなたが【ユーザーの引用】と深く悩んでいるからこそ、他者の【他者の引用】という言葉が、あなたの〇〇という無意識の願い（または本質的な課題）と強烈に共鳴したのですね」と、2つの文章がなぜ惹かれ合ったのかの『因果関係』を論理的かつ温かく解き明かす。

## ⚠️ 厳格な禁止事項（必ず守ること）
- ユーザーの言葉と他者の言葉の「直接引用（「」での抜粋）」がない分析は失格です。必ず両方から引用して結合させてください。
- 一切の一般論、自己啓発的美辞麗句（「自分らしさを大切に」「バランスが大事」等）、誰にでも言える浅いアドバイスを禁止します。
- ユーザーが書いてもいない状況を勝手に推測して決めつけないこと。すべては「提示されたテキストの中にある手がかり」から深い共感を導き出してください。

## 出力JSONフォーマット

{
  "title": "ユーザーの心にふっと光を差す、温かくも核心を突くタイトル（15字以内）",
  "thread": "【見えない共感の糸の解読（最低800字）】\\n必ず、ユーザーの悩みから具体的なフレーズを「」で引用し、次に他者のnoteから具体的なフレーズを「」で引用すること。そして、その2つのテキストがなぜ強く響き合ったのか、その深層心理のメカニズムを深く、深く掘り下げる。ユーザーの葛藤の根底にある「本当に大切にしたいこと」に寄り添いながら、『だからこそ、この言葉があなたの心に刺さったのですね』と、言葉を選んだ理由を紐解く。極めて分析的でありながらも、包み込むような温かい文章で記述すること。",
  "now": "【現在地の優しい肯定】\\n『あなたは今、〜という岐路に立って、〜という痛みを抱えていますね』というように、ユーザーの現状と葛藤を、どこまでも味方としての視点から言語化し、そのもがきが前に進もうとしている証拠であることを肯定する。",
  "be": "【あなただけの北極星】\\n惹かれた言葉を手がかりに、ユーザーが心の奥底で『本当はどうありたいと願っているのか』を言語化する。無理な目標ではなく、心に従った自然な在り方の提示。",
  "do": "【明日へのささやかな一歩】\\nいきなり大きな行動を促すのではなく、ユーザーの具体的な状況を踏まえた上で、明日から意識できる、あるいは小さく試せる具体的なアクションを1つだけ提案する。"
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

    const userPrompt = `あなたは、深い共感力と類まれな分析力を持つ伴走者です。以下の【ユーザーの悩み】と【惹かれた他者の言葉】を深く読み込み、なぜこの言葉がユーザーの琴線に触れたのか、その深層心理を紐解いてください。

## 【ユーザーの悩み（現在地・葛藤）】
${moyamoya}

## 【ユーザーが惹かれた他者の言葉（琴線に触れたトリガー）】
${sourcesText}

---
【極めて重要な指示】
必ず、ユーザーの悩みから1箇所以上、他者の言葉から1箇所以上、具体的なテキストを「」で引用してください。
そして、「なぜユーザーの悩みのこの部分と、他者のこの言葉が、深層心理で強く結びついたのか」を、温かく、かつ極めて論理的に解き明かしてください。指定されたJSON形式にのみ従うこと。`;

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
