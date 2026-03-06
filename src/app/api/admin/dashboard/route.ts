import { NextResponse } from 'next/server';

/**
 * Admin Dashboard API — Aggregates analytics_events into daily KPIs
 * Protected by ADMIN_SECRET query parameter
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 500 });
    }

    const supabase = createClient(url, key);

    // Date boundaries (JST: UTC+9)
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const todayStr = jstNow.toISOString().slice(0, 10);
    
    const todayStart = new Date(`${todayStr}T00:00:00+09:00`).toISOString();
    
    const yesterday = new Date(jstNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayStart = new Date(`${yesterdayStr}T00:00:00+09:00`).toISOString();
    
    const dayBefore = new Date(jstNow);
    dayBefore.setDate(dayBefore.getDate() - 2);
    const dayBeforeStr = dayBefore.toISOString().slice(0, 10);
    const dayBeforeStart = new Date(`${dayBeforeStr}T00:00:00+09:00`).toISOString();

    // Fetch events for yesterday and day before
    const [yesterdayEvents, dayBeforeEvents, todayEvents] = await Promise.all([
      supabase.from('analytics_events')
        .select('event_name, properties, session_id, created_at')
        .gte('created_at', yesterdayStart)
        .lt('created_at', todayStart)
        .order('created_at', { ascending: true }),
      supabase.from('analytics_events')
        .select('event_name, properties, session_id, created_at')
        .gte('created_at', dayBeforeStart)
        .lt('created_at', yesterdayStart)
        .order('created_at', { ascending: true }),
      supabase.from('analytics_events')
        .select('event_name, properties, session_id, created_at')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: true }),
    ]);

    const computeKPIs = (events: { event_name: string; properties: Record<string, unknown>; session_id: string }[]) => {
      const sessions = new Set(events.map(e => e.session_id));
      const byName = (name: string) => events.filter(e => e.event_name === name);

      const urlSubmits = byName('url_submit').length;
      const recommendCompletes = byName('recommend_complete').length;
      const bookmarkTaps = byName('bookmark_tap').length;
      const letterOpens = byName('letter_open').length;
      const amazonClicks = byName('amazon_click').length;
      const loadMoreTaps = byName('load_more').length;
      const signupModals = byName('signup_modal_show').length;
      const cardSwipes = byName('card_swipe').length;

      // Tier 1 KPIs
      const flowCompletionRate = urlSubmits > 0 ? Math.round((recommendCompletes / urlSubmits) * 100) : 0;
      const engageActions = bookmarkTaps + letterOpens + amazonClicks;
      const cardEngageRate = recommendCompletes > 0 ? Math.round((engageActions / recommendCompletes) * 100) : 0;
      const loadMoreRate = recommendCompletes > 0 ? Math.round((loadMoreTaps / recommendCompletes) * 100) : 0;

      // Tier 3: thumbnail hit rate
      const recommends = byName('recommend_complete');
      let totalBooks = 0;
      let thumbnailHits = 0;
      for (const e of recommends) {
        const props = e.properties as Record<string, number>;
        totalBooks += props.bookCount || 0;
        thumbnailHits += props.thumbnailHits || 0;
      }
      const thumbnailHitRate = totalBooks > 0 ? Math.round((thumbnailHits / totalBooks) * 100) : 0;

      // API durations
      const durations = recommends
        .map(e => (e.properties as Record<string, number>).durationMs)
        .filter(Boolean)
        .sort((a, b) => a - b);
      const p50Duration = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;

      const errors = byName('recommend_error').length + byName('api_error').length;

      return {
        uniqueSessions: sessions.size,
        urlSubmits,
        recommendCompletes,
        bookmarkTaps,
        letterOpens,
        amazonClicks,
        loadMoreTaps,
        signupModals,
        cardSwipes,
        // Tier 1
        flowCompletionRate,
        cardEngageRate,
        loadMoreRate,
        // Tier 3
        thumbnailHitRate,
        p50Duration,
        errorCount: errors,
        totalBooks,
        thumbnailHits,
      };
    };

    // Funnel data
    const computeFunnel = (events: { event_name: string; session_id: string }[]) => {
      const sessionsByStep: Record<string, Set<string>> = {
        'page_view': new Set(),
        'url_submit': new Set(),
        'recommend_start': new Set(),
        'recommend_complete': new Set(),
        'card_swipe': new Set(),
        'bookmark_tap': new Set(),
        'load_more': new Set(),
      };

      for (const e of events) {
        if (sessionsByStep[e.event_name]) {
          sessionsByStep[e.event_name].add(e.session_id);
        }
      }

      return [
        { step: 'TOP表示', count: sessionsByStep['page_view'].size },
        { step: 'URL submit', count: sessionsByStep['url_submit'].size },
        { step: 'AI検索開始', count: sessionsByStep['recommend_start'].size },
        { step: '結果表示', count: sessionsByStep['recommend_complete'].size },
        { step: 'カード操作', count: sessionsByStep['card_swipe'].size },
        { step: 'しおり', count: sessionsByStep['bookmark_tap'].size },
        { step: '追加検索', count: sessionsByStep['load_more'].size },
      ];
    };

    const yesterdayKPIs = computeKPIs(yesterdayEvents.data || []);
    const dayBeforeKPIs = computeKPIs(dayBeforeEvents.data || []);
    const todayKPIs = computeKPIs(todayEvents.data || []);
    const yesterdayFunnel = computeFunnel(yesterdayEvents.data || []);

    // Feature flags
    const { data: flags } = await supabase.from('feature_flags').select('*').order('id');

    return NextResponse.json({
      dates: { today: todayStr, yesterday: yesterdayStr, dayBefore: dayBeforeStr },
      today: todayKPIs,
      yesterday: yesterdayKPIs,
      dayBefore: dayBeforeKPIs,
      funnel: yesterdayFunnel,
      flags: flags || [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'DASHBOARD_FAILED' }, { status: 500 });
  }
}
