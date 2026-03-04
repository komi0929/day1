'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface NoteSource {
  id: string;
  url: string;
  note_title: string;
  excerpt: string;
}

interface Insight {
  title: string;
  thread: string;
  now: string;
  be: string;
  do: string;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function WorkspacePage() {
  const router = useRouter();
  const { user, session, loading } = useAuth();

  const [moyamoya, setMoyamoya] = useState('');
  const [sources, setSources] = useState<NoteSource[]>([
    { id: generateId(), url: '', note_title: '', excerpt: '' },
  ]);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const addSource = useCallback(() => {
    setSources(prev => [...prev, { id: generateId(), url: '', note_title: '', excerpt: '' }]);
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev);
  }, []);

  const updateSource = useCallback((id: string, field: keyof NoteSource, value: string) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }, []);

  const canExtract = moyamoya.trim().length > 0 && sources.some(s => s.excerpt.trim().length > 0);

  const handleExtract = async () => {
    if (!canExtract || !session) return;
    setAnalyzing(true);
    setError(null);
    setInsight(null);
    setSaved(false);

    try {
      const validSources = sources.filter(s => s.excerpt.trim().length > 0);
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          moyamoya: moyamoya.trim(),
          sources: validSources.map(s => ({
            url: s.url.trim(),
            note_title: s.note_title.trim(),
            excerpt: s.excerpt.trim(),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || '分析に失敗しました');
      }

      const data = await res.json();
      setInsight(data.insight);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '分析に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!insight || !session || !supabase || saving) return;
    setSaving(true);
    const db = supabase;

    try {
      const { data: insightData, error: insightError } = await db
        .from('insights')
        .insert({
          user_id: user!.id,
          original_moyamoya: moyamoya.trim(),
          insight_title: insight.title,
          insight_thread: insight.thread,
          insight_now: insight.now,
          insight_be: insight.be,
          insight_do: insight.do,
        })
        .select('id')
        .single();

      if (insightError) throw insightError;

      const validSources = sources.filter(s => s.excerpt.trim().length > 0);
      if (validSources.length > 0) {
        const { error: sourcesError } = await db
          .from('note_sources')
          .insert(
            validSources.map((s, i) => ({
              insight_id: insightData.id,
              url: s.url.trim(),
              note_title: s.note_title.trim(),
              excerpt: s.excerpt.trim(),
              sort_order: i,
            }))
          );
        if (sourcesError) throw sourcesError;
      }

      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setMoyamoya('');
    setSources([{ id: generateId(), url: '', note_title: '', excerpt: '' }]);
    setInsight(null);
    setSaved(false);
    setError(null);
  };

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <div className="gradient-main">
      {/* Navigation */}
      <nav className="compass-nav">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black text-gradient">Compass</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/library')} className="btn-ghost text-xs">
            📚 Library
          </button>
          <button
            onClick={async () => {
              const { signOut } = await import('@/lib/auth-context').then(() => ({ signOut: () => supabase?.auth.signOut() }));
              await signOut();
              router.replace('/login');
            }}
            className="text-xs font-medium"
            style={{ color: 'var(--color-text-dim)' }}
          >
            ログアウト
          </button>
        </div>
      </nav>

      {/* Workspace Split View */}
      <main className="workspace-layout" style={{ paddingTop: '56px' }}>
        {/* ─── Left Panel: Input Pool ─── */}
        <div className="workspace-panel workspace-panel-left">
          <div className="max-w-xl mx-auto flex flex-col gap-8">
            {/* もやもや入力 */}
            <section>
              <label className="block text-xs font-bold mb-3 tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>
                💭 今のもやもや
              </label>
              <textarea
                className="textarea-auto"
                placeholder="言語化できなくても大丈夫。頭の中にあることを、そのまま書き出してみてください..."
                value={moyamoya}
                onChange={e => setMoyamoya(e.target.value)}
                maxLength={2000}
                style={{ minHeight: '140px' }}
              />
              <p className="text-right text-xs mt-1.5" style={{ color: 'var(--color-text-dim)' }}>
                {moyamoya.length}/2000
              </p>
            </section>

            {/* noteソースリスト */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  📝 惹かれた他者の言葉
                </label>
                <button
                  onClick={addSource}
                  className="text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
                  style={{ color: 'var(--color-accent)', background: 'rgba(208, 115, 74, 0.10)' }}
                >
                  ＋ 追加
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {sources.map((source, index) => (
                  <div key={source.id} className="source-card">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold" style={{ color: 'var(--color-text-dim)' }}>
                        note {index + 1}
                      </span>
                      {sources.length > 1 && (
                        <button
                          onClick={() => removeSource(source.id)}
                          className="text-xs"
                          style={{ color: 'var(--color-text-dim)' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <input
                        className="input-field text-xs"
                        placeholder="URL（任意）"
                        value={source.url}
                        onChange={e => updateSource(source.id, 'url', e.target.value)}
                      />
                      <input
                        className="input-field text-xs"
                        placeholder="タイトル（任意）"
                        value={source.note_title}
                        onChange={e => updateSource(source.id, 'note_title', e.target.value)}
                      />
                      <textarea
                        className="textarea-auto text-sm"
                        placeholder="心に残った文章・フレーズを貼り付けてください..."
                        value={source.excerpt}
                        onChange={e => updateSource(source.id, 'excerpt', e.target.value)}
                        style={{ minHeight: '80px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 抽出ボタン */}
            <button
              onClick={handleExtract}
              disabled={!canExtract || analyzing}
              className="btn-primary w-full text-base py-4"
            >
              {analyzing ? (
                <span className="analyzing-pulse">🔭 深層を探索中...</span>
              ) : (
                '🧭 Compassで抽出'
              )}
            </button>

            {error && (
              <div className="p-3 text-xs rounded-lg" style={{ background: 'rgba(232, 101, 90, 0.12)', color: 'var(--g-coral)', border: '1px solid rgba(232, 101, 90, 0.2)' }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right Panel: Output Board ─── */}
        <div className="workspace-panel" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="max-w-xl mx-auto">
            {!insight && !analyzing && (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <div className="text-6xl mb-6 opacity-20">🧭</div>
                <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-dim)' }}>
                  あなたの指針を見つけよう
                </h2>
                <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'var(--color-text-dim)' }}>
                  左のパネルに「もやもや」と「惹かれた他者の言葉」を入力して、
                  <br />Compassで抽出してみてください。
                </p>
              </div>
            )}

            {analyzing && (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <div className="text-5xl mb-6 analyzing-pulse">🔭</div>
                <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  深層を探索しています
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
                  あなたの言葉と他者の知見を横断分析中...
                </p>
              </div>
            )}

            {insight && (
              <div className="fade-in-up">
                {/* Title */}
                <h2 className="text-2xl font-black mb-2 text-gradient leading-tight">
                  {insight.title}
                </h2>
                <div className="h-px my-6" style={{ background: 'var(--color-border)' }} />

                {/* The Thread */}
                <div className="insight-section">
                  <p className="insight-label insight-label-thread">THE THREAD — 見えない共感の糸</p>
                  <p className="text-sm leading-[1.9]" style={{ color: 'var(--color-text)' }}>
                    {insight.thread}
                  </p>
                </div>

                {/* Now */}
                <div className="insight-section">
                  <p className="insight-label insight-label-now">NOW — 現在地の受容</p>
                  <p className="text-sm leading-[1.9]" style={{ color: 'var(--color-text)' }}>
                    {insight.now}
                  </p>
                </div>

                {/* Be */}
                <div className="insight-section">
                  <p className="insight-label insight-label-be">BE — 北極星</p>
                  <p className="text-sm leading-[1.9]" style={{ color: 'var(--color-text)' }}>
                    {insight.be}
                  </p>
                </div>

                {/* Do */}
                <div className="insight-section">
                  <p className="insight-label insight-label-do">DO — 明日への一歩</p>
                  <p className="text-sm leading-[1.9] font-medium" style={{ color: 'var(--color-text)' }}>
                    {insight.do}
                  </p>
                </div>

                <div className="h-px my-6" style={{ background: 'var(--color-border)' }} />

                {/* Save / Actions */}
                <div className="flex gap-3">
                  {!saved ? (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn-primary flex-1"
                    >
                      {saving ? '保存中...' : '📚 このインサイトを記録する'}
                    </button>
                  ) : (
                    <div className="flex-1 text-center py-3 rounded-xl text-sm font-bold"
                      style={{ background: 'rgba(90, 148, 98, 0.12)', color: 'var(--color-success)' }}>
                      ✓ Libraryに記録しました
                    </div>
                  )}
                  <button onClick={handleReset} className="btn-ghost">
                    新しく始める
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
