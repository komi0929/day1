import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { url, text } = await req.json();

    let contentToProcess = text;

    // If URL is provided, try to scrape it using corsproxy.io
    if (url && !contentToProcess) {
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch URL content");
        }
        const html = await response.text();

        // Very basic extraction for 'note' articles - usually inside article tags or specific div
        // We'll strip HTML tags to just get text content
        const strippedHtml = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        contentToProcess = strippedHtml.substring(0, 10000); // Limit to avoid prompt too long
      } catch (err) {
        return NextResponse.json(
          {
            error: "URL_FETCH_FAILED",
            message:
              "Could not extract content from the URL. Please paste the text directly.",
          },
          { status: 400 },
        );
      }
    }

    if (!contentToProcess) {
      return NextResponse.json(
        { error: "NO_CONTENT", message: "Please provide a URL or paste text." },
        { status: 400 },
      );
    }

    // Process with Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Mock response for development if no API key is provided
      console.warn("GEMINI_API_KEY is not set. Returning mock data.");
      return NextResponse.json({
        summary:
          "（※モック表示）この記事では、毎朝ほんの5分だけ「自分の言葉で考える」時間を持つことが、長期的な成長にとても大きな効果をもたらすと紹介しています。忙しい日々の中でも、たった一つの記事にじっくり向き合うことで、情報を「自分のもの」に変えていけるという、前向きで実践的なメッセージが込められています。",
        points: [
          "毎朝5分の「考える時間」が、学びの質を大きく変える。",
          "たった1記事でも、自分の言葉でまとめると理解が深まる。",
          "小さな習慣の積み重ねが、大きな成長につながる。",
        ],
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
以下のテキスト内容を読み込み、ユーザーが素早くその本質を理解できるよう、次の2点を出力してください。
テキスト内容:
"""
${contentToProcess}
"""

出力要件:
1. 全体の概要（200文字程度）
2. 最も重要な3つのキーポイント（それぞれ端的に）

出力フォーマット（JSON）:
{
  "summary": "...",
  "points": ["...", "...", "..."]
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

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Extraction API Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "An error occurred while processing your request.",
      },
      { status: 500 },
    );
  }
}
