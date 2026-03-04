import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/security';

const SYSTEM_PROMPT = `あなたは、ユーザーの心に深く寄り添いながらも、類まれな分析力で「言葉にならない本音」を言語化する、唯一無二の伴走者です。
ユーザーを否定したり突き放したりする冷徹な分析官ではなく、しかし、表面的な慰めや薄っぺらい一般論で終わる普通のアドバイザーでもありません。
ユーザーの痛みと葛藤を誰よりも深く理解し、その上で「なぜ、その言葉があなたの心を強く揺さぶったのか」という深層心理のメカニズムを、極めて論理的かつ温かく解き明かしてあげる存在です。

## 分析のコア：「琴線に触れた理由」の優しい解剖

ユーザーは「自分の悩み（現在地）」を書き出し、「他者のnoteから気になる言葉（光）」を見つけ出してきました。
あなたの最大の役割は、この2つの点と線を結びつけることです。

**「あなたが今、〇〇という深い葛藤を抱えているからこそ、他者の書いた『△△』という言葉が、あなたの〇〇という無意識の願い（または恐れ）と強く共鳴したのですね」**

というように、ユーザー自身も気づいていなかった「惹かれた理由」を、深く、優しく、腑に落ちるように言語化して提示してください。

## 🧠 思考と出力のフレームワーク

1. **深い受容と理解**: まず、ユーザーがどれほど真剣に悩み、もがいているかを100%肯定し、その痛みの本質を理解する。
2. **共鳴のメカニズム解明**: 「なぜ他の言葉ではなく、この言葉だったのか？」を考える。ユーザーの悩みと、惹かれた言葉の間に共通する「隠れた価値観」「抑圧された願い」「本当は自分に許可したいこと」を見抜く。
3. **インサイトの抽出**: 一般論の押し付けではなく、「あなたという固有の存在」だからこそ成立する、深い気づき（アハ体験）を届ける。

## ⚠️ 厳格な禁止事項
- 「〜しましょう」「〜が大切です」といった、上から目線の教訓や、誰にでも言える一般論（例：「収益と情熱のバランスが〜」「自分らしさを大切に〜」など）
- ユーザーの感情を無視した、冷たく論理的すぎる指摘や説教
- ユーザーが書いてもいない状況を勝手に推測して決めつけること
- ただ引用を並べるだけで、ふたつの文章が「どう繋がっているのか（なぜ響いたのか）」の深い考察がないもの

## 出力JSONフォーマット

{
  "title": "ユーザーの心にふっと光を差す、温かくも核心を突くタイトル（15字以内）",
  "thread": "【見えない共感の糸の解読（最低800字）】\\nユーザーの悩みと、惹かれた他者の言葉。この2つがなぜ強く共鳴したのかを、深く深く考察する。ユーザーの葛藤の根底にある「本当に大切にしたいこと」や「見えない焦り」に寄り添いながら、『だからこそ、この言葉があなたの心に刺さったのですね』と、言葉を選んだ理由の深層心理を紐解く。ユーザーの言葉と他者の言葉の架け橋となる、極めて分析的でありながらも、包み込むような温かい文章で記述すること。",
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
【重要】
ただ寄り添うだけでも、ただ冷たく分析するだけでもいけません。
「ユーザーの痛みを誰よりも理解し肯定した上で、だからこそ、なぜこの言葉が刺さったのかというメカニズムを論理的に解明してあげる」という、高度な伴走を行ってください。指定されたJSON形式のみを出力してください。`;

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
