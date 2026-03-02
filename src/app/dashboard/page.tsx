'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface Bookmark {
  id: string;
  url: string;
  title: string;
  status: 'unread' | 'done';
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [url, setUrl] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeTab, setActiveTab] = useState<'unread' | 'done'>('unread');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Load bookmarks from Supabase
  const loadBookmarks = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBookmarks(data as Bookmark[]);
    }
  }, [user]);

  // Load streak from profile
  const loadStreak = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from('profiles')
      .select('streak')
      .eq('id', user.id)
      .single();

    if (data) {
      setStreak(data.streak ?? 0);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadBookmarks();
      loadStreak();
    }
  }, [user, loadBookmarks, loadStreak]);

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !supabase || !user) return;

    if (!url.includes('note.com')) {
      setError('現在、noteの記事URLのみ対応しています。');
      return;
    }

    const title = url.split('/').pop()?.replace(/-/g, ' ') || 'Untitled';

    const { error: insertError } = await supabase
      .from('bookmarks')
      .insert({
        user_id: user.id,
        url: url.trim(),
        title,
        status: 'unread',
      });

    if (insertError) {
      setError('ブックマークの追加に失敗しました。');
      return;
    }

    setUrl('');
    setError(null);
    loadBookmarks();
  };

  const handleSelectArticle = async (bookmark: Bookmark) => {
    setLoading(bookmark.id);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: bookmark.url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || '記事の取得に失敗しました。');
        setLoading(null);
        return;
      }

      // Store learning data for the learn page (temporary, used during session)
      sessionStorage.setItem('day1_current_learn', JSON.stringify({
        bookmarkId: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        summary: data.summary,
        points: data.points,
      }));

      router.push('/learn');
    } catch {
      setError('通信エラーが発生しました。');
    } finally {
      setLoading(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const unread = bookmarks.filter(b => b.status === 'unread');
  const done = bookmarks.filter(b => b.status === 'done');
  const currentList = activeTab === 'unread' ? unread : done;

  if (authLoading || !user) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: 'var(--color-cream)' }}>

      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-text)' }}>day1</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-light)' }}>
            {streak > 0 ? `🔥 ${streak}日連続！` : 'おはようございます ☀️'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-light)', background: 'var(--color-cream-dark)' }}
        >
          ログアウト
        </button>
      </header>

      {/* Add URL */}
      <section className="px-5 pb-4">
        <form onSubmit={handleAddUrl} className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="note記事のURLを追加..."
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
          <button
            type="submit"
            className="px-4 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 shrink-0"
            style={{ background: 'var(--color-accent)' }}
          >
            追加
          </button>
        </form>
        {error && (
          <p className="mt-2 text-xs px-1" style={{ color: '#DC2626' }}>{error}</p>
        )}
      </section>

      {/* Tabs */}
      <div className="px-5 flex gap-1 mb-3">
        <button
          onClick={() => setActiveTab('unread')}
          className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all"
          style={{
            background: activeTab === 'unread' ? 'var(--color-accent)' : 'var(--color-cream-dark)',
            color: activeTab === 'unread' ? '#fff' : 'var(--color-text-light)',
          }}
        >
          未読 ({unread.length})
        </button>
        <button
          onClick={() => setActiveTab('done')}
          className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all"
          style={{
            background: activeTab === 'done' ? 'var(--color-accent)' : 'var(--color-cream-dark)',
            color: activeTab === 'done' ? '#fff' : 'var(--color-text-light)',
          }}
        >
          完了済み ({done.length})
        </button>
      </div>

      {/* List */}
      <section className="flex-1 px-5 pb-8 overflow-y-auto">
        {currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl">📚</span>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-light)' }}>
              {activeTab === 'unread' ? 'noteの記事URLを追加してみましょう！' : 'まだ完了した記事がありません。'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {currentList.map((bm) => (
              <li key={bm.id}>
                <button
                  onClick={() => activeTab === 'unread' ? handleSelectArticle(bm) : undefined}
                  disabled={loading === bm.id || activeTab === 'done'}
                  className="w-full text-left p-4 rounded-xl transition-all active:scale-[0.98] shadow-sm"
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    opacity: loading === bm.id ? 0.6 : 1,
                    cursor: activeTab === 'done' ? 'default' : 'pointer',
                  }}
                >
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                    {bm.title}
                  </p>
                  <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-light)' }}>
                    {bm.url}
                  </p>
                  {loading === bm.id && (
                    <p className="text-xs mt-2 font-medium" style={{ color: 'var(--color-accent-dark)' }}>
                      AIが記事を読み取っています...
                    </p>
                  )}
                  {activeTab === 'done' && bm.status === 'done' && (
                    <p className="text-xs mt-2" style={{ color: 'var(--color-accent-dark)' }}>☀️ 学び完了</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

    </main>
  );
}
