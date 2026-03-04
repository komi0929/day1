'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface InsightRecord {
  id: string;
  insight_title: string;
  insight_thread: string;
  original_moyamoya: string;
  created_at: string;
  note_sources: { note_title: string; url: string; excerpt: string }[];
}

export default function LibraryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !supabase) return;
    const db = supabase;

    const fetchInsights = async () => {
      const { data, error } = await db
        .from('insights')
        .select(`
          id, insight_title, insight_thread, original_moyamoya, created_at,
          note_sources ( note_title, url, excerpt )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setInsights(data as InsightRecord[]);
      }
      setFetching(false);
    };

    fetchInsights();
  }, [user]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading || fetching) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <div className="gradient-cool min-h-dvh">
      {/* Navigation */}
      <nav className="compass-nav">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black text-gradient">Compass</h1>
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-dim)' }}>/ Library</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/workspace')} className="btn-ghost text-xs">
            🧭 Workspace
          </button>
        </div>
      </nav>

      <main className="pt-[72px] pb-12 px-6">
        <div className="max-w-3xl mx-auto">
          <header className="mb-10">
            <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text)' }}>
              Insight Library
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              あなたの思考の軌跡。{insights.length}件のインサイト
            </p>
          </header>

          {insights.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-6xl mb-6 opacity-20">📚</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-dim)' }}>
                まだインサイトがありません
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-dim)' }}>
                Workspaceで抽出したインサイトがここに蓄積されます
              </p>
              <button onClick={() => router.push('/workspace')} className="btn-primary">
                🧭 Workspaceへ
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {insights.map((record) => (
              <div
                key={record.id}
                className="library-card"
                onClick={() => router.push(`/library/${record.id}`)}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-base font-bold leading-snug text-gradient">
                    {record.insight_title}
                  </h3>
                  <time className="text-xs font-medium shrink-0" style={{ color: 'var(--color-text-dim)' }}>
                    {formatDate(record.created_at)}
                  </time>
                </div>

                <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                  {record.insight_thread}
                </p>

                {/* 気になる言葉のプレビュー */}
                {record.note_sources && record.note_sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {record.note_sources.map((src, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full line-clamp-1"
                        style={{ background: 'rgba(139, 107, 181, 0.10)', color: 'var(--g-violet)' }}
                      >
                        &ldquo;{(src.excerpt || src.note_title || 'note').slice(0, 25)}{(src.excerpt || src.note_title || '').length > 25 ? '…' : ''}&rdquo;
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
