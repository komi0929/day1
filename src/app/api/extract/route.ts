import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { validateNoteUrl, authenticateRequest } from "@/lib/security";

// ============================================
// Mock data for when GEMINI_API_KEY is not set
// ============================================
const MOCK_DO_RESPONSE = {
  articleType: "DO" as const,
  articleTitle: "【モック】生産性を3倍にする朝のルーティン",
  ideas: [
    {
      id: "idea-1",
      text: "明日から出社前の15分間、最も重要なタスクを1つだけ紙に書き出してから仕事を始める",
    },
    {
      id: "idea-2",
      text: "通勤中のSNSチェックをやめ、その時間で今日の目標を3つ頭の中で整理する",
    },
    {
      id: "idea-3",
      text: "夜寝る前に翌日の服と持ち物を準備し、朝の意思決定コストを減らす",
    },
  ],
  question: null,
};

const MOCK_BE_RESPONSE = {
  articleType: "BE" as const,
  articleTitle: "【モック】誰かの人生を覗くということ",
  ideas: null,
  question:
    "著者は「他者の痛みに想像力を向けること自体が、すでに優しさである」と語っています。最近あなたが誰かの話を聞いて、自分の中に静かに何かが響いた瞬間はありますか？",
};

// ============================================
// Fetch and extract text content from URL
// ============================================
async function fetchArticleText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en;q=0.9",
    },
    signal: AbortSignal.timeout(10000), // 10秒タイムアウト
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const strippedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return strippedHtml.substring(0, 12000);
}

// ============================================
// Main API handler
// ============================================
export async function POST(req: Request) {
  try {
    // 🔒 認証チェック
    const authResult = await authenticateRequest(req);
    if (authResult instanceof NextResponse) return authResult;

    const { url, text, userChallenges } = await req.json();

    let contentToProcess = text;

    // 🔒 URLバリデーション（SSRF防止）
    if (url && !contentToProcess) {
      const validation = validateNoteUrl(url);
      if (!validation.valid) {
        return NextResponse.json(
          { error: "INVALID_URL", message: validation.error },
          { status: 400 },
        );
      }

      try {
        contentToProcess = await fetchArticleText(url);
      } catch {
        return NextResponse.json(
          {
            error: "URL_FETCH_FAILED",
            message:
              "記事の取得に失敗しました。テキストを直接貼り付けてください。",
          },
          { status: 400 },
        );
      }
    }

    if (!contentToProcess) {
      return NextResponse.json(
        {
          error: "NO_CONTENT",
          message: "URLまたはテキストを入力してください。",
        },
        { status: 400 },
      );
    }

    // テキスト入力の長さ制限
    if (typeof contentToProcess === 'string' && contentToProcess.length > 50000) {
      contentToProcess = contentToProcess.substring(0, 50000);
    }

    // Check for API key — return mock if not set
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Returning mock data.");
      const hash = (url || text || "").length;
      return NextResponse.json(hash % 2 === 0 ? MOCK_DO_RESPONSE : MOCK_BE_RESPONSE);
    }

    // ============================================
    // Gemini AI: Multi-step prompt
    // ============================================
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const challengesContext = userChallenges && userChallenges.length > 0
      ? `ユーザーが現在向き合っているテーマ: ${userChallenges.join("、")}`
      : "ユーザーの課題情報はまだ設定されていません。一般的な提案をしてください。";

    const prompt = `
あなたは「day1」というアプリのAIアシスタントです。noteの記事を読んだユーザーが、その学びを「血肉化」するための手助けをします。

以下のテキスト内容を読み込み、2つのステップで処理してください。

## テキスト内容:
"""
${contentToProcess}
"""

## ユーザーコンテキスト:
${challengesContext}

---

## Step 1: 記事タイプの判定
この記事を以下の2つのタイプに分類してください:
- **DO**: ノウハウ、ビジネス、ライフハックなど、具体的な行動変容を促す記事
- **BE**: エッセイ、物語、個人の深い体験談、哲学など、視点や在り方の変容を促す記事

## Step 2: タイプに応じた出力

### DOの場合:
著者の知見とユーザーの課題を掛け合わせて、ユーザーが**明日から実行できる超具体的なアクション案**を3つ提案してください。
- 各アクションは1〜2文で、「いつ」「何を」「どうする」が明確であること
- 著者の主張をそのまま転記するのではなく、ユーザーの現在の課題に翻訳すること

### BEの場合:
著者の「特有のレンズ・価値観」を抽出し、ユーザーの過去の体験や感情を引き出す**オープンクエスチョン**を1つだけ出力してください。
- 要約やアクションの提案は一切しない
- ユーザー自身の記憶や感情にアクセスさせる問い
- 押しつけがましくなく、静かに内省を促すトーン

---

## 出力フォーマット（JSON厳守）:

DOの場合:
{
  "articleType": "DO",
  "articleTitle": "記事のタイトル（推定）",
  "ideas": [
    { "id": "idea-1", "text": "アクション案1" },
    { "id": "idea-2", "text": "アクション案2" },
    { "id": "idea-3", "text": "アクション案3" }
  ],
  "question": null
}

BEの場合:
{
  "articleType": "BE",
  "articleTitle": "記事のタイトル（推定）",
  "ideas": null,
  "question": "問いかけの文"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response as JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate response shape
    if (!parsed.articleType || !["DO", "BE"].includes(parsed.articleType)) {
      throw new Error("Invalid articleType in AI response");
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Extraction API Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "処理中にエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
