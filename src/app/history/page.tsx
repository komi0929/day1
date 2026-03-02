'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface HistorySession {
  id: string;
  article_type: 'DO' | 'BE' | null;
  ai_summary: string;
  user_commitment: string;
  user_emotion_tags: string[];
  user_reflection: string;
  check_in_status: string;
  completed_at: string;
  bookmarks: {
    url: string;
    title: string;
  } | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<HistorySession[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: 'var(--color-cream)' }}>

      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm"
          style={{ color: 'var(--color-accent-dark)' }}
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>学習履歴</h1>
      </header>

      {/* List */}
      <section className="flex-1 px-5 pb-8">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl">🌅</span>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-light)' }}>
              まだ学習履歴がありません。
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="p-4 rounded-xl shadow-sm"
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
              >
                {/* Header row */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {session.article_type ? (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: session.article_type === 'DO' ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)',
                        color: session.article_type === 'DO' ? '#3B82F6' : '#A855F7',
                      }}
                    >
                      {session.article_type === 'DO' ? '🔧 DO' : '🌿 BE'}
                    </span>
                    ) : (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(120,120,120,0.1)', color: '#888' }}
                    >
                      📝 旧版
                    </span>
                    )}
                    <span className="text-[10px]" style={{ color: 'var(--color-text-light)' }}>
                      {formatDate(session.completed_at)}
                    </span>
                  </div>
                  {session.article_type === 'DO' && (
                    <span className="text-[10px] font-medium" style={{
                      color: session.check_in_status === 'completed' ? '#34D399' :
                        session.check_in_status === 'skipped' ? '#F87171' : 'var(--color-text-light)'
                    }}>
                      {session.check_in_status === 'completed' ? '✅ 達成' :
                        session.check_in_status === 'skipped' ? '⏭️ スキップ' : '⏳ チェックイン待ち'}
                    </span>
                  )}
                </div>

                {/* Title */}
                <p className="text-sm font-semibold mb-2 line-clamp-1" style={{ color: 'var(--color-text)' }}>
                  {session.bookmarks?.title || session.ai_summary || 'タイトルなし'}
                </p>

                {/* DO: commitment */}
                {session.article_type === 'DO' && session.user_commitment && (
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-light)' }}>
                    💡 {session.user_commitment}
                  </p>
                )}

                {/* BE: emotions + reflection */}
                {session.article_type === 'BE' && (
                  <div className="flex flex-col gap-1">
                    {session.user_emotion_tags && session.user_emotion_tags.length > 0 && (
                      <div className="flex gap-1">
                        {session.user_emotion_tags.map((emoji, i) => (
                          <span key={i} className="text-lg">{emoji}</span>
                        ))}
                      </div>
                    )}
                    {session.user_reflection && (
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-light)' }}>
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
