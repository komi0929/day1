'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface NoteSource {
  id: string;
  url: string;
  note_title: string;
  excerpt: string;
  sort_order: number;
}

interface InsightDetail {
  id: string;
  original_moyamoya: string;
  insight_title: string;
  insight_thread: string;
  insight_now: string;
  insight_be: string;
  insight_do: string;
  created_at: string;
  note_sources: NoteSource[];
}

export default function LibraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [record, setRecord] = useState<InsightDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !supabase || !id) return;
    const db = supabase;

    const fetchDetail = async () => {
      const { data, error } = await db
        .from('insights')
        .select(`
          id, original_moyamoya, insight_title, insight_thread, insight_now, insight_be, insight_do, created_at,
          note_sources ( id, url, note_title, excerpt, sort_order )
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        const sorted = {
          ...data,
          note_sources: (data.note_sources as NoteSource[]).sort((a, b) => a.sort_order - b.sort_order),
        };
        setRecord(sorted as InsightDetail);
      }
      setFetching(false);
    };

    fetchDetail();
  }, [user, id]);

  const handleDelete = async () => {
    if (!supabase || !record || deleting) return;
    if (!window.confirm('このインサイトを削除しますか？')) return;
    setDeleting(true);
    const db = supabase;

    await db.from('insights').delete().eq('id', record.id);
    router.replace('/library');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  if (loading || fetching) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gradient-main gap-4">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>インサイトが見つかりません</p>
        <button onClick={() => router.push('/library')} className="btn-ghost">← Library に戻る</button>
      </main>
    );
  }

  return (
    <div className="gradient-warm min-h-dvh">
      {/* Navigation */}
      <nav className="compass-nav">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/library')}
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ← Library
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-medium"
            style={{ color: 'var(--color-danger)' }}
          >
            {deleting ? '削除中...' : '削除'}
          </button>
        </div>
      </nav>

      <main className="pt-[72px] pb-16 px-6">
        <article className="max-w-2xl mx-auto">
          {/* Header */}
          <header className="mb-10">
            <time className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-dim)' }}>
              {formatDate(record.created_at)}
            </time>
            <h1 className="text-3xl font-black text-gradient leading-tight mb-4">
              {record.insight_title}
            </h1>
          </header>

          {/* 当時のもやもや */}
          <section className="mb-10">
            <h3 className="text-[10px] font-extrabold tracking-[2px] uppercase mb-4" style={{ color: 'var(--color-text-dim)' }}>
              💭 当時のもやもや
            </h3>
            <div className="card p-5">
              <p className="text-sm leading-[1.9]" style={{ color: 'var(--color-text-muted)' }}>
                {record.original_moyamoya}
              </p>
            </div>
          </section>

          {/* ベースとなったnote群 */}
          <section className="mb-10">
            <h3 className="text-[10px] font-extrabold tracking-[2px] uppercase mb-4" style={{ color: 'var(--color-text-dim)' }}>
              📝 ベースとなったnote
            </h3>
            <div className="flex flex-col gap-3">
              {record.note_sources.map((src) => (
                <div key={src.id} className="source-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--g-violet)' }}>
                      {src.note_title || '(無題)'}
                    </span>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] underline"
                        style={{ color: 'var(--color-text-dim)' }}
                      >
                        元記事 →
                      </a>
                    )}
                  </div>
                  <p className="text-xs leading-[1.8]" style={{ color: 'var(--color-text-muted)' }}>
                    {src.excerpt}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="h-px my-8" style={{ background: 'var(--color-border)' }} />

          {/* The Thread */}
          <div className="insight-section">
            <p className="insight-label insight-label-thread">THE THREAD — 見えない共感の糸</p>
            <p className="text-[15px] leading-[2]">
              {record.insight_thread}
            </p>
          </div>

          {/* Now */}
          <div className="insight-section">
            <p className="insight-label insight-label-now">NOW — 現在地の受容</p>
            <p className="text-[15px] leading-[2]">
              {record.insight_now}
            </p>
          </div>

          {/* Be */}
          <div className="insight-section">
            <p className="insight-label insight-label-be">BE — 北極星</p>
            <p className="text-[15px] leading-[2]">
              {record.insight_be}
            </p>
          </div>

          {/* Do */}
          <div className="insight-section">
            <p className="insight-label insight-label-do">DO — 明日への一歩</p>
            <p className="text-[15px] leading-[2] font-medium">
              {record.insight_do}
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
