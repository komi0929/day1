'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface Selection {
  id: string;
  note_url: string | null;
  note_title: string;
  note_body_excerpt: string;
  books: BookData[];
  fragments: string[];
  created_at: string;
}

interface BookData {
  title: string;
  author: string;
  label?: string;
  headline?: string;
  oneliner?: string;
  summary?: string;
  letter?: string;
  thumbnail?: string;
  amazonUrl?: string;
}

interface Bookmark {
  id: string;
  book_title: string;
  book_author: string;
  book_label: string;
  book_headline: string;
  book_oneliner: string;
  book_summary: string;
  book_letter: string;
  book_thumbnail: string;
  book_amazon_url: string;
  created_at: string;
}

type Tab = 'history' | 'bookmarks';

export default function LibraryPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [selections, setSelections] = useState<Selection[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSelection, setExpandedSelection] = useState<string | null>(null);

  const fetchLibrary = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/library', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelections(data.selections || []);
        setBookmarks(data.bookmarks || []);
      }
    } catch (e) {
      console.error('Library fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (user && session) {
      fetchLibrary();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, session, authLoading, fetchLibrary]);

  const removeBookmark = async (bookmark: Bookmark) => {
    if (!session?.access_token) return;
    setBookmarks(prev => prev.filter(b => b.id !== bookmark.id));
    try {
      await fetch('/api/bookmarks', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookTitle: bookmark.book_title,
          bookAuthor: bookmark.book_author,
        }),
      });
    } catch (e) {
      console.error('Remove bookmark error:', e);
      fetchLibrary();
    }
  };

  // Not logged in
  if (!authLoading && !user) {
    return (
      <main className="min-h-dvh gradient-warm">
        <div className="noise-bg" />
        <div className="content-layer">
          <div className="max-w-lg mx-auto px-5 py-20 text-center">
            <div className="text-6xl mb-8 opacity-80">📚</div>
            <h1 className="text-2xl font-extrabold mb-4" style={{ color: 'var(--color-text)' }}>
              あなただけの本棚
            </h1>
            <p className="text-sm leading-relaxed mb-10" style={{ color: 'var(--color-text-muted)' }}>
              お手紙と一緒に届いた本を、ここにそっとしまっておけます。<br />
              次にお会いした時、また続きのお話ができるように。
            </p>
            <AuthForm />
            <Link
              href="/"
              className="block mt-6 text-sm"
              style={{ color: 'var(--color-text-dim)' }}
            >
              ← まずは本を探してみる
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-dvh gradient-warm flex items-center justify-center">
        <div className="noise-bg" />
        <div className="content-layer text-center analyzing-pulse">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            本棚を開いています…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh gradient-warm">
      <div className="noise-bg" />
      <div className="content-layer">
        <div className="max-w-3xl mx-auto px-5 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-extrabold" style={{ color: 'var(--color-text)' }}>
                わたしの本棚
              </h1>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>
                {user?.user_metadata?.full_name || 'ゲスト'}さんの場所
              </p>
            </div>
            <Link href="/" className="btn-ghost text-xs py-2 px-4">
              本を探しにいく →
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'text-white shadow-sm'
                  : ''
              }`}
              style={activeTab === 'history'
                ? { background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))' }
                : { color: 'var(--color-text-dim)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }
              }
            >
              これまでに綴った言葉たち
            </button>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'bookmarks'
                  ? 'text-white shadow-sm'
                  : ''
              }`}
              style={activeTab === 'bookmarks'
                ? { background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))' }
                : { color: 'var(--color-text-dim)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }
              }
            >
              いつか読む本
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'history' ? (
            <HistoryTab
              selections={selections}
              expandedSelection={expandedSelection}
              setExpandedSelection={setExpandedSelection}
            />
          ) : (
            <BookmarksTab bookmarks={bookmarks} onRemove={removeBookmark} />
          )}
        </div>
      </div>
    </main>
  );
}

/* ─── History Tab ─── */
function HistoryTab({
  selections,
  expandedSelection,
  setExpandedSelection,
}: {
  selections: Selection[];
  expandedSelection: string | null;
  setExpandedSelection: (id: string | null) => void;
}) {
  if (selections.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      {selections.map((sel) => (
        <div key={sel.id} className="card p-5 fade-in-up">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-bold" style={{ color: 'var(--g-coral)' }}>
                {new Date(sel.created_at).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>
              {sel.note_title && (
                <h3 className="text-sm font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                  {sel.note_title}
                </h3>
              )}
            </div>
            {sel.note_url && (
              <a
                href={sel.note_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs shrink-0"
                style={{ color: 'var(--color-accent)' }}
              >
                元のnote →
              </a>
            )}
          </div>

          {/* Fragments */}
          {sel.fragments && sel.fragments.length > 0 && (
            <div className="mb-4 pl-3" style={{ borderLeft: '2px solid var(--g-coral)', opacity: 0.7 }}>
              <p className="text-xs italic leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {sel.fragments[0]}
              </p>
            </div>
          )}

          {/* Books grid (collapsed/expanded) */}
          <button
            onClick={() => setExpandedSelection(expandedSelection === sel.id ? null : sel.id)}
            className="text-xs font-bold w-full text-left py-2"
            style={{ color: 'var(--color-text-dim)' }}
          >
            📚 {sel.books?.length || 0}冊の本が見つかりました
            <span className="ml-2">{expandedSelection === sel.id ? '▲' : '▼'}</span>
          </button>

          {expandedSelection === sel.id && sel.books && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {sel.books.map((book: BookData, i: number) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-24 mx-auto mb-2 rounded overflow-hidden shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={book.thumbnail || '/default-cover.png'}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/default-cover.png'; }}
                    />
                  </div>
                  <p className="text-[10px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                    {book.title}
                  </p>
                  <p className="text-[9px]" style={{ color: 'var(--color-text-dim)' }}>
                    {book.author}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Bookmarks Tab ─── */
function BookmarksTab({
  bookmarks,
  onRemove,
}: {
  bookmarks: Bookmark[];
  onRemove: (b: Bookmark) => void;
}) {
  if (bookmarks.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
      {bookmarks.map((bm) => (
        <div key={bm.id} className="card p-4 fade-in-up group relative">
          {/* Remove button */}
          <button
            onClick={() => onRemove(bm)}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            style={{ color: 'var(--color-text-dim)' }}
            title="しおりをはずす"
          >
            ✕
          </button>

          {/* Cover */}
          <div className="w-full aspect-2/3 rounded-lg overflow-hidden shadow-sm mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bm.book_thumbnail || '/default-cover.png'}
              alt={bm.book_title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = '/default-cover.png'; }}
            />
          </div>

          {/* Info */}
          <h3 className="text-xs font-bold leading-tight mb-1" style={{ color: 'var(--color-text)' }}>
            {bm.book_title}
          </h3>
          <p className="text-[10px] mb-2" style={{ color: 'var(--color-text-dim)' }}>
            {bm.book_author}
          </p>
          {bm.book_oneliner && (
            <p className="text-[10px] italic" style={{ color: 'var(--g-coral)' }}>
              {bm.book_oneliner}
            </p>
          )}

          {/* Amazon link */}
          {bm.book_amazon_url && (
            <a
              href={bm.book_amazon_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[10px] font-bold mt-3 text-center py-1.5 rounded-md transition-all"
              style={{ color: 'var(--color-accent)', background: 'rgba(208, 115, 74, 0.06)' }}
            >
              この本を見てみる →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Auth Form ─── */
function AuthForm() {
  const { signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUpWithEmail(email, password);
        if (error) { setError(error); }
        else { setEmailSent(true); }
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) { setError(error); }
      }
    } catch {
      setError('うまくいきませんでした。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  if (emailSent) {
    return (
      <div className="card p-6 text-center fade-in-up">
        <div className="text-3xl mb-3">✉️</div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
          確認メールをお送りしました。<br />
          メール内のリンクをクリックして、本棚の鍵を開けてください。
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xs mx-auto">
      {/* Google */}
      <button
        onClick={() => signInWithGoogle()}
        className="btn-ghost w-full flex items-center justify-center gap-2 mb-4 py-3"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Googleではじめる
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
        <span className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>または</span>
        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
      </div>

      {/* Email form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          className="input-field"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
        <input
          type="password"
          className="input-field"
          placeholder="パスワード（6文字以上）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full py-3"
        >
          {submitting ? '...' : mode === 'signup' ? '本棚をつくる（無料）' : 'ログインする'}
        </button>
      </form>

      {/* Toggle */}
      <button
        onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); }}
        className="mt-4 text-xs block mx-auto"
        style={{ color: 'var(--color-text-dim)' }}
      >
        {mode === 'signup' ? 'すでに本棚をお持ちの方はこちら' : 'はじめての方はこちら'}
      </button>
    </div>
  );
}

/* ─── Empty State ─── */
function EmptyState() {
  return (
    <div className="py-20 text-center">
      <p
        className="text-sm leading-loose max-w-xs mx-auto"
        style={{ color: 'var(--color-text-dim)', fontStyle: 'italic' }}
      >
        まだここには何もありませんが、<br />
        あなたが言葉を紡ぐたび、<br />
        ここはあなただけの特別な場所になっていきます。
      </p>
    </div>
  );
}
