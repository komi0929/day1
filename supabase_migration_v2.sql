-- ============================================
-- day1 アプリ — ピボット版 マイグレーション SQL
-- ============================================
-- 実行方法: Supabase Dashboard → SQL Editor → New Query → 貼り付けて Run
-- 注意: 既存データには影響しません（全てADD COLUMN / IF NOT EXISTS）
-- ============================================
-- 1. profiles テーブル拡張
-- ============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_challenges jsonb DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.profiles.current_challenges IS 'オンボーディングで取得したユーザーの課題・目標（例: ["仕事/キャリア","マインド/メンタル"]）';
-- ============================================
-- 2. bookmarks テーブル拡張
-- ============================================
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS image_url text,
    ADD COLUMN IF NOT EXISTS shared_at timestamptz,
    ADD COLUMN IF NOT EXISTS ai_processing_status text NOT NULL DEFAULT 'pending' CHECK (
        ai_processing_status IN ('pending', 'processing', 'completed', 'failed')
    );
COMMENT ON COLUMN public.bookmarks.shared_at IS 'PWA Web Share Target から共有された日時';
COMMENT ON COLUMN public.bookmarks.ai_processing_status IS 'AI処理の状態 (pending→processing→completed/failed)';
-- ============================================
-- 3. learning_sessions テーブル拡張
-- ============================================
ALTER TABLE public.learning_sessions
ADD COLUMN IF NOT EXISTS article_type text CHECK (article_type IN ('DO', 'BE')),
    ADD COLUMN IF NOT EXISTS ai_generated_ideas jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS ai_generated_question text DEFAULT '',
    ADD COLUMN IF NOT EXISTS user_commitment text DEFAULT '',
    ADD COLUMN IF NOT EXISTS user_emotion_tags text [] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS user_reflection text DEFAULT '',
    ADD COLUMN IF NOT EXISTS check_in_status text NOT NULL DEFAULT 'pending' CHECK (
        check_in_status IN ('pending', 'completed', 'skipped')
    );
COMMENT ON COLUMN public.learning_sessions.article_type IS 'AIが判定した記事タイプ: DO(行動変容) / BE(視点変容)';
COMMENT ON COLUMN public.learning_sessions.ai_generated_ideas IS 'DO向け: AI生成のアクション提案3つ (jsonb array)';
COMMENT ON COLUMN public.learning_sessions.ai_generated_question IS 'BE向け: AI生成の深い問い';
COMMENT ON COLUMN public.learning_sessions.user_commitment IS 'DO向け: ユーザーが決定した最終アクション';
COMMENT ON COLUMN public.learning_sessions.user_emotion_tags IS 'BE向け: ユーザーが選択した感情タグ';
COMMENT ON COLUMN public.learning_sessions.user_reflection IS 'BE向け: 問いに対するユーザーの自由記述';
COMMENT ON COLUMN public.learning_sessions.check_in_status IS '翌日チェックイン状態: pending(未)/completed(済)/skipped(スキップ)';
-- ============================================
-- 4. インデックス追加
-- ============================================
CREATE INDEX IF NOT EXISTS idx_learning_sessions_checkin ON public.learning_sessions(user_id, check_in_status)
WHERE check_in_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bookmarks_ai_status ON public.bookmarks(user_id, ai_processing_status)
WHERE ai_processing_status != 'completed';