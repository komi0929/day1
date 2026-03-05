-- ============================================
-- compass — Supabase Database Schema
-- かかりつけ私設図書館機能
-- ※ 既存のテーブル・ポリシーがあっても安全に実行可能
-- ============================================
-- 1. profiles テーブル（ユーザプロファイル）
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text,
    display_name text,
    created_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for
select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for
update using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles;
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
            new.raw_user_meta_data->>'full_name',
            split_part(new.email, '@', 1)
        )
    );
return new;
end;
$$ language plpgsql security definer;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after
insert on auth.users for each row execute procedure public.handle_new_user();
-- 2. selections テーブル（選書履歴）
create table if not exists public.selections (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    note_url text,
    note_title text default '',
    note_body_excerpt text default '',
    books jsonb not null default '[]',
    fragments jsonb not null default '[]',
    created_at timestamptz default now()
);
alter table public.selections enable row level security;
drop policy if exists "Users can view own selections" on public.selections;
create policy "Users can view own selections" on public.selections for
select using (auth.uid() = user_id);
drop policy if exists "Users can insert own selections" on public.selections;
create policy "Users can insert own selections" on public.selections for
insert with check (auth.uid() = user_id);
-- 3. bookmarks テーブル（しおりをはさんだ本）
create table if not exists public.bookmarks (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    selection_id uuid references public.selections(id) on delete cascade,
    book_title text not null,
    book_author text not null,
    book_label text default '',
    book_headline text default '',
    book_oneliner text default '',
    book_summary text default '',
    book_letter text default '',
    book_thumbnail text default '',
    book_amazon_url text default '',
    created_at timestamptz default now(),
    unique(user_id, book_title, book_author)
);
alter table public.bookmarks enable row level security;
drop policy if exists "Users can view own bookmarks" on public.bookmarks;
create policy "Users can view own bookmarks" on public.bookmarks for
select using (auth.uid() = user_id);
drop policy if exists "Users can insert own bookmarks" on public.bookmarks;
create policy "Users can insert own bookmarks" on public.bookmarks for
insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own bookmarks" on public.bookmarks;
create policy "Users can delete own bookmarks" on public.bookmarks for delete using (auth.uid() = user_id);
-- 4. heart_profiles テーブル（心のカルテ — ユーザーには見せない）
create table if not exists public.heart_profiles (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    selection_id uuid references public.selections(id) on delete cascade,
    note_url text,
    summary text not null,
    created_at timestamptz default now()
);
alter table public.heart_profiles enable row level security;
drop policy if exists "Users can view own heart_profiles" on public.heart_profiles;
create policy "Users can view own heart_profiles" on public.heart_profiles for
select using (auth.uid() = user_id);
drop policy if exists "Users can insert own heart_profiles" on public.heart_profiles;
create policy "Users can insert own heart_profiles" on public.heart_profiles for
insert with check (auth.uid() = user_id);
-- Indexes
create index if not exists idx_selections_user_id on public.selections(user_id);
create index if not exists idx_selections_created on public.selections(user_id, created_at desc);
create index if not exists idx_bookmarks_user_id on public.bookmarks(user_id);
create index if not exists idx_heart_profiles_user_id on public.heart_profiles(user_id);
create index if not exists idx_heart_profiles_created on public.heart_profiles(user_id, created_at desc);