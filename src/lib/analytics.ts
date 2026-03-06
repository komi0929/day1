/**
 * Analytics Wrapper — compass
 * 
 * Client-side: track(event, props) → fire-and-forget POST to /api/analytics
 * Server-side: trackServer(event, props) → direct Supabase insert
 */

// ─── Session ID (per browser session) ─── 
let sessionId: string | null = null;

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  if (sessionId) return sessionId;
  
  // Try to reuse from sessionStorage
  try {
    const stored = sessionStorage.getItem('compass_session_id');
    if (stored) {
      sessionId = stored;
      return stored;
    }
  } catch { /* SSR or restricted */ }
  
  // Generate new session ID
  sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    sessionStorage.setItem('compass_session_id', sessionId);
  } catch { /* ignore */ }
  
  return sessionId;
}

// ─── Client-side tracking ───
export function track(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  
  const payload = {
    sessionId: getSessionId(),
    eventName,
    properties,
    pagePath: window.location.pathname,
    referrer: document.referrer || '',
    timestamp: Date.now(),
  };

  // Fire-and-forget — never block UI
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', JSON.stringify(payload));
    } else {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never throw from analytics
  }
}

// ─── Timer helper for measuring durations ───
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

// ─── Server-side tracking (import only in API routes) ───
export async function trackServer(
  eventName: string,
  properties: Record<string, unknown> = {},
  req?: Request
) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);

    // Extract IP hash for basic deduplication
    let ipHash = '';
    if (req) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || 'unknown';
      // Simple hash - not cryptographic, just for grouping
      ipHash = btoa(ip).slice(0, 12);
    }

    await supabase.from('analytics_events').insert({
      session_id: `srv_${Date.now()}`,
      event_name: eventName,
      properties,
      ip_hash: ipHash,
      page_path: '/api',
    });
  } catch (e) {
    console.error('Analytics server track error:', e);
  }
}
