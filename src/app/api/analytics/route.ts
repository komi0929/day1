import { NextResponse } from 'next/server';

/**
 * Analytics Event Receiver
 * Receives client-side events and stores in Supabase
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    if (!body) return NextResponse.json({ ok: true });

    const { sessionId, eventName, properties, pagePath, referrer } = JSON.parse(body);

    if (!eventName || !sessionId) {
      return NextResponse.json({ ok: true }); // Silent fail, don't break UI
    }

    // Dynamic import to avoid build issues
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(url, key);

    // Extract IP hash
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const ipHash = btoa(ip).slice(0, 12);

    await supabase.from('analytics_events').insert({
      session_id: sessionId,
      event_name: eventName,
      properties: properties || {},
      page_path: pagePath || '/',
      referrer: referrer || '',
      user_agent: req.headers.get('user-agent') || '',
      ip_hash: ipHash,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Never fail analytics — always return 200
    return NextResponse.json({ ok: true });
  }
}
