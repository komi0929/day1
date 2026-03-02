'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface Bookmark {
  id: string;
  url: string;
  title: string;
  image_url: string | null;
  status: 'unread' | 'done';
  ai_processing_status: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [url, setUrl] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeTab, setActiveTab] = useState<'unread' | 'done'>('unread');
  const [loading, setLoading] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [pendingCheckIn, setPendingCheckIn] = useState<{
    id: string;
    user_commitment: string;
    articleTitle: string;
  } | null>(null);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const profileReady = !authLoading && user && profile !== null;
  const hasOnboarded = profile?.current_challenges && profile.current_challenges.length > 0;

  useEffect(() => {
    if (profileReady && !hasOnboarded) {
      router.replace('/onboarding');
    }
  }, [profileReady, hasOnboarded, router]);

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

  const checkPendingCheckIns = useCallback(async () => {
    if (!supabase || !user) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('learning_sessions')
      .select('id, user_commitment, ai_summary, completed_at')
      .eq('user_id', user.id)
      .eq('article_type', 'DO')
      .eq('check_in_status', 'pending')
      .not('user_commitment', 'eq', '')
      .lt('completed_at', todayStart.toISOString())
      .order('completed_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const session = data[0];
      setPendingCheckIn({
        id: session.id,
        user_commitment: session.user_commitment || '',
        articleTitle: session.ai_summary || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadBookmarks();
      loadStreak();
      checkPendingCheckIns();
    }
  }, [user, loadBookmarks, loadStreak, checkPendingCheckIns]);

  const handleCheckIn = async (status: 'completed' | 'skipped') => {
    if (!supabase || !user || !pendingCheckIn) return;
    setCheckInSubmitting(true);

    await supabase
      .from('learning_sessions')
      .update({ check_in_status: status })
      .eq('id', pendingCheckIn.id)
      .eq('user_id', user.id);

    setPendingCheckIn(null);
    setCheckInSubmitting(false);
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!supabase) return {};
    const { data: { session: s } } = await supabase.auth.getSession();
    return s?.access_token ? { 'Authorization': `Bearer ${s.access_token}` } : {};
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !supabase || !user) return;

    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('note.com')) {
        setError('note.comのhttps記事URLのみ対応しています。');
        return;
      }
    } catch {
      setError('URLの形式が正しくありません。');
      return;
    }

    setAdding(true);
    setError(null);

    try {
      let title = url.split('/').pop()?.replace(/-/g, ' ') || 'Untitled';
      let imageUrl: string | null = null;

      try {
        const authHeaders = await getAuthHeaders();
        const ogpRes = await fetch('/api/ogp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ url: url.trim() }),
        });
        const ogpData = await ogpRes.json();
        if (ogpData.title) title = ogpData.title;
        if (ogpData.image) imageUrl = ogpData.image;
      } catch {
        // OGP fetch failed
      }

      const { error: insertError } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          url: url.trim(),
          title,
          image_url: imageUrl,
          status: 'unread',
          ai_processing_status: 'pending',
        });

      if (insertError) {
        setError('ブックマークの追加に失敗しました。');
        return;
      }

      setUrl('');
      setError(null);
      loadBookmarks();
    } finally {
      setAdding(false);
    }
  };

  const handleSelectArticle = async (bookmark: Bookmark) => {
    setLoading(bookmark.id);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          url: bookmark.url,
          userChallenges: profile?.current_challenges || [],
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || '記事の取得に失敗しました。');
        setLoading(null);
        return;
      }

      sessionStorage.setItem('day1_current_learn', JSON.stringify({
        bookmarkId: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        articleType: data.articleType,
        ideas: data.ideas,
        question: data.question,
        articleTitle: data.articleTitle,
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== '削除する' || !supabase) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(s?.access_token ? { 'Authorization': `Bearer ${s.access_token}` } : {}),
        },
      });

      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.message || 'アカウントの削除に失敗しました。');
        setDeleting(false);
        return;
      }

      // ローカルセッションをクリアしてログイン画面へ
      await signOut();
      router.replace('/login');
    } catch {
      setDeleteError('通信エラーが発生しました。');
      setDeleting(false);
    }
  };

  const unread = bookmarks.filter(b => b.status === 'unread');
  const done = bookmarks.filter(b => b.status === 'done');
  const currentList = activeTab === 'unread' ? unread : done;

  if (authLoading || !user || !profileReady) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col gradient-main">

      {/* Check-in Modal */}
      {pendingCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(44,37,32,0.35)', backdropFilter: 'blur(6px)' }}>
          <div className="card-raised w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                昨日のアクション、どうでした？
              </h3>
            </div>

            <div
              className="card p-4 text-sm leading-relaxed"
              style={{ color: 'var(--color-text)' }}
            >
              {pendingCheckIn.user_commitment}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleCheckIn('completed')}
                disabled={checkInSubmitting}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'var(--g-sage)' }}
              >
                できた！
              </button>
              <button
                onClick={() => handleCheckIn('completed')}
                disabled={checkInSubmitting}
                className="btn-ghost w-full"
              >
                アレンジしてやった
              </button>
              <button
                onClick={() => handleCheckIn('skipped')}
                disabled={checkInSubmitting}
                className="w-full py-3 rounded-xl text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ color: 'var(--color-text-dim)' }}
              >
                できなかった（スキップ）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gradient">day1</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
            {streak > 0 ? `${streak}日連続達成` : 'おはようございます'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-dim)', background: 'var(--color-surface)' }}
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
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={adding}
            className="btn-primary shrink-0 disabled:opacity-50"
            style={{ padding: '12px 16px' }}
          >
            {adding ? '取得中' : '追加'}
          </button>
        </form>
        {error && (
          <p className="mt-2 text-xs px-1" style={{ color: 'var(--g-coral)' }}>{error}</p>
        )}
      </section>

      {/* Tabs */}
      <div className="px-5 flex gap-1 mb-3">
        <button
          onClick={() => setActiveTab('unread')}
          className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all"
          style={{
            background: activeTab === 'unread' ? 'linear-gradient(135deg, var(--g-coral), var(--g-peach))' : 'var(--color-surface)',
            color: activeTab === 'unread' ? '#fff' : 'var(--color-text-muted)',
          }}
        >
          未読 ({unread.length})
        </button>
        <button
          onClick={() => setActiveTab('done')}
          className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all"
          style={{
            background: activeTab === 'done' ? 'linear-gradient(135deg, var(--g-coral), var(--g-peach))' : 'var(--color-surface)',
            color: activeTab === 'done' ? '#fff' : 'var(--color-text-muted)',
          }}
        >
          完了済み ({done.length})
        </button>
      </div>

      {/* List */}
      <section className="flex-1 px-5 pb-8 overflow-y-auto">
        {currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-dim)' }}>
              {activeTab === 'unread' ? 'noteの記事URLを追加してみましょう' : 'まだ完了した記事がありません'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {currentList.map((bm) => (
              <li key={bm.id}>
                <button
                  onClick={() => activeTab === 'unread' ? handleSelectArticle(bm) : undefined}
                  disabled={loading === bm.id || activeTab === 'done'}
                  className="card w-full text-left transition-all active:scale-[0.98] overflow-hidden"
                  style={{
                    opacity: loading === bm.id ? 0.6 : 1,
                    cursor: activeTab === 'done' ? 'default' : 'pointer',
                  }}
                >
                  <div className="p-3 flex gap-3 items-center">
                    {bm.image_url && (
                      <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)' }}>
                        <img
                          src={bm.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-2 leading-snug" style={{ color: 'var(--color-text)' }}>
                        {bm.title}
                      </p>
                      {loading === bm.id && (
                        <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--color-accent)' }}>
                          AIが学びを準備中...
                        </p>
                      )}
                      {activeTab === 'done' && bm.status === 'done' && (
                        <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--color-accent)' }}>学習済み</p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Account Danger Zone */}
      <section className="px-5 pb-10">
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError(null); }}
          className="w-full py-3 text-xs font-medium rounded-xl transition-all active:scale-[0.98]"
          style={{ color: 'var(--color-text-dim)', border: '1px solid var(--color-border)' }}
        >
          アカウントを削除する
        </button>
      </section>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(44,37,32,0.35)', backdropFilter: 'blur(6px)' }}>
          <div className="card-raised w-full max-w-sm p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-center" style={{ color: 'var(--color-text)' }}>
              アカウントを削除しますか？
            </h3>
            <p className="text-xs leading-relaxed text-center" style={{ color: 'var(--color-text-muted)' }}>
              すべてのデータ（ブックマーク・学習履歴）が完全に削除され、<strong>元に戻せません。</strong>
            </p>

            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--color-text-dim)' }}>
                確認のため「削除する」と入力してください
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="削除する"
                className="input-field w-full"
                autoComplete="off"
              />
            </div>

            {deleteError && (
              <p className="text-xs text-center" style={{ color: 'var(--g-coral)' }}>{deleteError}</p>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== '削除する' || deleting}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-30"
                style={{ background: '#e25c5c' }}
              >
                {deleting ? '削除中...' : '完全に削除する'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="btn-ghost w-full"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
