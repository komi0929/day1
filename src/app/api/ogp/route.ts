import { NextResponse } from "next/server";
import { validateNoteUrl, authenticateRequest } from "@/lib/security";

export async function POST(req: Request) {
  try {
    // 🔒 認証チェック
    const authResult = await authenticateRequest(req);
    if (authResult instanceof NextResponse) return authResult;

    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // 🔒 URLバリデーション（SSRF防止）
    const validation = validateNoteUrl(url);
    if (!validation.valid) {
      return NextResponse.json({ title: "", image: "", error: validation.error });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; day1-bot/1.0)",
      },
      signal: AbortSignal.timeout(10000), // 10秒タイムアウト
    });

    if (!response.ok) {
      return NextResponse.json({ title: "", image: "" });
    }

    const html = await response.text();

    // Extract og:title
    const ogTitleMatch = html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i
    ) || html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i
    );

    // Extract og:image
    const ogImageMatch = html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i
    ) || html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i
    );

    // Fallback: extract <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);

    const title = ogTitleMatch?.[1] || titleMatch?.[1] || "";
    const image = ogImageMatch?.[1] || "";

    return NextResponse.json({ title: title.trim(), image });
  } catch {
    return NextResponse.json({ title: "", image: "" });
  }
}
