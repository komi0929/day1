'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface HistorySession {
  id: string;
  article_type: string | null;
  ai_summary: string;
  user_commitment: string | null;
  user_emotion_tags: string[] | null;
  user_reflection: string | null;
  check_in_status: string | null;
  completed_at: string;
  bookmark_id: string | null;
  memo_action: string | null;
  bookmarks: { url: string; title: string } | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<HistorySession[]>([]);

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;

    const { data, error } = await supabase
      .from('learning_sessions')
      .select(`
        id,
        article_type,
        ai_summary,
        user_commitment,
        user_emotion_tags,
        user_reflection,
        check_in_status,
        completed_at,
        bookmark_id,
        memo_action,
        bookmarks (url, title)
      `)
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    if (!error && data) {
      setSessions(data as unknown as HistorySession[]);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col gradient-cool">
      <header className="px-5 pt-6 pb-4 flex justify-between items-center">
        <h1 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>学習履歴</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="btn-ghost text-xs"
        >
          戻る
        </button>
      </header>

      <section className="flex-1 px-5 pb-8 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-dim)' }}>
              まだ学習履歴がありません
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="card p-4"
              >
                {/* Header row */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {session.article_type ? (
                    <span className={`badge ${session.article_type === 'DO' ? 'badge-do' : 'badge-be'}`}>
                      {session.article_type}
                    </span>
                    ) : (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-dim)' }}>
                      旧版
                    </span>
                    )}
                    <span className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                      {formatDate(session.completed_at)}
                    </span>
                  </div>
                  {session.article_type === 'DO' && (
                    <span className="text-[10px] font-medium" style={{
                      color: session.check_in_status === 'completed' ? 'var(--g-sage)' :
                        session.check_in_status === 'skipped' ? 'var(--g-coral)' : 'var(--color-text-dim)'
                    }}>
                      {session.check_in_status === 'completed' ? '達成' :
                        session.check_in_status === 'skipped' ? 'スキップ' : 'チェックイン待ち'}
                    </span>
                  )}
                </div>

                {/* Title */}
                <p className="text-sm font-semibold mb-2 line-clamp-1" style={{ color: 'var(--color-text)' }}>
                  {session.bookmarks?.title || session.ai_summary || 'タイトルなし'}
                </p>

                {/* DO: commitment */}
                {session.article_type === 'DO' && session.user_commitment && (
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                    {session.user_commitment}
                  </p>
                )}

                {/* BE: emotions + reflection */}
                {session.article_type === 'BE' && (
                  <div className="flex flex-col gap-1">
                    {session.user_emotion_tags && session.user_emotion_tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {session.user_emotion_tags.map((tag, i) => (
                          <span key={i} className="badge badge-be text-[9px]">{tag}</span>
                        ))}
                      </div>
                    )}
                    {session.user_reflection && (
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                        {session.user_reflection}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
