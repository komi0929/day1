-- ============================================
-- compass — Analytics & Feature Flags Schema
-- ============================================
-- 1. analytics_events テーブル（イベントログ）
create table if not exists public.analytics_events (
    id uuid default gen_random_uuid() primary key,
    session_id text not null,
    event_name text not null,
    properties jsonb default '{}',
    user_id uuid references public.profiles(id) on delete
    set null,
        page_path text default '/',
        referrer text default '',
        user_agent text default '',
        ip_hash text default '',
        created_at timestamptz default now()
);
-- RLS: サーバーサイドのみ書き込み（service role key使用）、adminのみ読み取り
alter table public.analytics_events enable row level security;
-- Service role can do everything (used by API)
drop policy if exists "Service role full access" on public.analytics_events;
create policy "Service role full access" on public.analytics_events for all using (true) with check (true);
-- Indexes for dashboard queries
create index if not exists idx_analytics_created on public.analytics_events(created_at desc);
create index if not exists idx_analytics_event_name on public.analytics_events(event_name, created_at desc);
create index if not exists idx_analytics_session on public.analytics_events(session_id);
-- 2. feature_flags テーブル
create table if not exists public.feature_flags (
    id text primary key,
    enabled boolean default true,
    description text default '',
    updated_at timestamptz default now()
);
alter table public.feature_flags enable row level security;
-- Everyone can read flags (needed by client)
drop policy if exists "Anyone can read flags" on public.feature_flags;
create policy "Anyone can read flags" on public.feature_flags for
select using (true);
-- Service role can update
drop policy if exists "Service role can manage flags" on public.feature_flags;
create policy "Service role can manage flags" on public.feature_flags for all using (true) with check (true);
-- Insert default flags
insert into public.feature_flags (id, enabled, description)
values (
        'enable_google_books_fallback',
        true,
        'Google Books表紙フォールバック'
    ),
    (
        'enable_phase2_recommendations',
        true,
        '追加3冊検索機能'
    ),
    ('enable_signup_modal', true, 'しおり時の登録促進モーダル'),
    ('enable_home_warning', true, 'ホーム戻り時の警告表示'),
    ('max_book_batches', true, '最大バッチ数制御（3バッチ=9冊）') on conflict (id) do nothing;
-- 3. daily_kpi_cache テーブル（集計キャッシュ）
create table if not exists public.daily_kpi_cache (
    date date not null,
    kpi_name text not null,
    value numeric default 0,
    metadata jsonb default '{}',
    updated_at timestamptz default now(),
    primary key (date, kpi_name)
);
alter table public.daily_kpi_cache enable row level security;
drop policy if exists "Service role full access on kpi" on public.daily_kpi_cache;
create policy "Service role full access on kpi" on public.daily_kpi_cache for all using (true) with check (true);
create index if not exists idx_kpi_date on public.daily_kpi_cache(date desc);