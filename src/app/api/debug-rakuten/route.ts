import { NextResponse } from 'next/server';

/**
 * 楽天API診断エンドポイント
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || '嫌われる勇気';

  const rawAppId = process.env.RAKUTEN_APP_ID ?? '<<NOT SET>>';
  const rakutenAffId = process.env.RAKUTEN_AFFILIATE_ID || '';

  // IDの詳細診断
  const idDiag = {
    length: rawAppId.length,
    first5: rawAppId.slice(0, 5),
    last5: rawAppId.slice(-5),
    hasWhitespace: /\s/.test(rawAppId),
    hasNewline: /[\r\n]/.test(rawAppId),
    hasQuote: /["']/.test(rawAppId),
    isNumeric: /^\d+$/.test(rawAppId),
    trimmedLength: rawAppId.trim().length,
  };

  const cleanAppId = rawAppId.trim();

  if (cleanAppId === '<<NOT SET>>' || !cleanAppId) {
    return NextResponse.json({ error: 'RAKUTEN_APP_ID not set', idDiag });
  }

  const url = `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId=${cleanAppId}&title=${encodeURIComponent(title)}&hits=3&format=json${rakutenAffId ? `&affiliateId=${rakutenAffId}` : ''}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await res.text();

    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }

    const items = parsed?.Items?.map((w: { Item?: Record<string, string> }) => ({
      title: w?.Item?.title,
      author: w?.Item?.author,
      hasLargeImage: !!w?.Item?.largeImageUrl,
      hasMediumImage: !!w?.Item?.mediumImageUrl,
    })) || [];

    return NextResponse.json({
      searchTitle: title,
      httpStatus: res.status,
      resultCount: parsed?.count || 0,
      items,
      idDiag,
      rawError: res.status !== 200 ? body.slice(0, 500) : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), searchTitle: title, idDiag });
  }
}
