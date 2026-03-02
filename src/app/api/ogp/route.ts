import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; day1-bot/1.0)",
      },
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
