-- ============================================
-- day1 アプリ — Supabase Database Schema
-- ============================================
-- 1. profiles テーブル（ユーザプロファイル）
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text,
    display_name text,
    streak integer default 0,
    last_completed_at timestamptz,
    created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for
select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for
update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for
insert with check (auth.uid() = id);
-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger as $$ begin
insert into public.profiles (id, email, display_name)
values (
        new.id,
        new.email,
        coalesce(
            new.raw_user_meta_data->>'display_name',
            split_part(new.email, '@', 1)
        )
    );
return new;
end;
$$ language plpgsql security definer;
-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after
insert on auth.users for each row execute procedure public.handle_new_user();
-- 2. bookmarks テーブル（ブックマーク/note記事URL）
create table if not exists public.bookmarks (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    url text not null,
    title text not null default 'Untitled',
    status text not null default 'unread' check (status in ('unread', 'done')),
    created_at timestamptz default now()
);
alter table public.bookmarks enable row level security;
create policy "Users can view own bookmarks" on public.bookmarks for
select using (auth.uid() = user_id);
create policy "Users can insert own bookmarks" on public.bookmarks for
insert with check (auth.uid() = user_id);
create policy "Users can update own bookmarks" on public.bookmarks for
update using (auth.uid() = user_id);
create policy "Users can delete own bookmarks" on public.bookmarks for delete using (auth.uid() = user_id);
-- 3. learning_sessions テーブル（学習セッション結果）
create table if not exists public.learning_sessions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    bookmark_id uuid references public.bookmarks(id) on delete
    set null,
        memo_action text default '',
        memo_question text default '',
        memo_learning text default '',
        ai_summary text default '',
        ai_points text [] default '{}',
        completed_at timestamptz default now()
);
alter table public.learning_sessions enable row level security;
create policy "Users can view own sessions" on public.learning_sessions for
select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.learning_sessions for
insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.learning_sessions for
update using (auth.uid() = user_id);
-- Index for common queries
create index if not exists idx_bookmarks_user_id on public.bookmarks(user_id);
create index if not exists idx_bookmarks_user_status on public.bookmarks(user_id, status);
create index if not exists idx_learning_sessions_user_id on public.learning_sessions(user_id);
create index if not exists idx_learning_sessions_completed on public.learning_sessions(user_id, completed_at desc);