-- ============================================
-- Compass — Supabase Database Schema
-- ============================================
-- 1. profiles テーブル（既存を維持）
-- 既存のprofilesテーブルをそのまま利用
-- 2. insights テーブル（インサイト記録）
create table if not exists public.insights (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    original_moyamoya text not null default '',
    insight_title text not null default '',
    insight_thread text not null default '',
    insight_now text not null default '',
    insight_be text not null default '',
    insight_do text not null default '',
    created_at timestamptz default now()
);
alter table public.insights enable row level security;
create policy "Users can view own insights" on public.insights for
select using (auth.uid() = user_id);
create policy "Users can insert own insights" on public.insights for
insert with check (auth.uid() = user_id);
create policy "Users can update own insights" on public.insights for
update using (auth.uid() = user_id);
create policy "Users can delete own insights" on public.insights for delete using (auth.uid() = user_id);
-- 3. note_sources テーブル（インサイトに紐づくnote引用）
create table if not exists public.note_sources (
    id uuid default gen_random_uuid() primary key,
    insight_id uuid references public.insights(id) on delete cascade not null,
    url text not null default '',
    note_title text not null default '',
    excerpt text not null default '',
    sort_order integer not null default 0,
    created_at timestamptz default now()
);
alter table public.note_sources enable row level security;
create policy "Users can view own note_sources" on public.note_sources for
select using (
        exists (
            select 1
            from public.insights
            where insights.id = note_sources.insight_id
                and insights.user_id = auth.uid()
        )
    );
create policy "Users can insert own note_sources" on public.note_sources for
insert with check (
        exists (
            select 1
            from public.insights
            where insights.id = note_sources.insight_id
                and insights.user_id = auth.uid()
        )
    );
create policy "Users can delete own note_sources" on public.note_sources for delete using (
    exists (
        select 1
        from public.insights
        where insights.id = note_sources.insight_id
            and insights.user_id = auth.uid()
    )
);
-- Indexes
create index if not exists idx_insights_user_id on public.insights(user_id);
create index if not exists idx_insights_created on public.insights(user_id, created_at desc);
create index if not exists idx_note_sources_insight on public.note_sources(insight_id);