import { NextResponse } from 'next/server';

/**
 * 楽天API診断エンドポイント
 * /api/debug-rakuten?title=書籍タイトル で楽天APIの生レスポンスを確認
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || '嫌われる勇気';

  const rakutenAppId = process.env.RAKUTEN_APP_ID || '';
  const rakutenAffId = process.env.RAKUTEN_AFFILIATE_ID || '';

  if (!rakutenAppId) {
    return NextResponse.json({ error: 'RAKUTEN_APP_ID not set', envKeys: Object.keys(process.env).filter(k => k.includes('RAKUTEN')) });
  }

  const url = `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId=${rakutenAppId}&title=${encodeURIComponent(title)}&hits=5&format=json${rakutenAffId ? `&affiliateId=${rakutenAffId}` : ''}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const statusCode = res.status;
    const body = await res.text();

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }

    // Extract just the titles and images from the response
    const items = parsed?.Items?.map((w: { Item?: Record<string, string> }) => ({
      title: w?.Item?.title,
      author: w?.Item?.author,
      largeImageUrl: w?.Item?.largeImageUrl,
      mediumImageUrl: w?.Item?.mediumImageUrl,
    })) || [];

    return NextResponse.json({
      searchTitle: title,
      rakutenStatus: statusCode,
      resultCount: parsed?.count || 0,
      items,
      appIdSet: !!rakutenAppId,
      affIdSet: !!rakutenAffId,
      appIdLength: rakutenAppId.length,
      rawBody: statusCode !== 200 ? body.slice(0, 500) : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), searchTitle: title, appIdSet: !!rakutenAppId });
  }
}
