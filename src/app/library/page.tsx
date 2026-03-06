'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

/* ─── Types ─── */
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
  book_summary: string;
  book_letter: string;
  book_thumbnail: string;
  book_amazon_url: string;
  created_at: string;
  selection_id?: string;
}

/* ═══════════════════════════════════════════════
   Main Library Page
   ═══════════════════════════════════════════════ */
export default function LibraryPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [selections, setSelections] = useState<Selection[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [hiddenBooks, setHiddenBooks] = useState<Set<string>>(new Set());
  const [modalBook, setModalBook] = useState<{ book: BookData; fragment?: string; date?: string } | null>(null);
  const migratedRef = useRef(false);

  // ─── Data fetching ───
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

  // ─── localStorage → DB migration (Critical Fix #3) ───
  useEffect(() => {
    if (!session?.access_token || !user || migratedRef.current) return;
    migratedRef.current = true;

    const migrateData = async () => {
      const token = session.access_token;
      let didMigrate = false;

      // Migrate pending selections
      try {
        const pendingRaw = localStorage.getItem('compass_pending');
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          if (Array.isArray(pending) && pending.length > 0) {
            for (const sel of pending) {
              try {
                await fetch('/api/save-selection', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({
                    noteUrl: sel.noteUrl || null,
                    noteTitle: sel.noteTitle || '',
                    noteBody: sel.noteBody || '',
                    books: sel.books || [],
                    fragments: sel.fragments || [],
                  }),
                });
              } catch { /* continue */ }
            }
            localStorage.removeItem('compass_pending');
            didMigrate = true;
          }
        }
      } catch { /* ignore parse errors */ }

      // Migrate bookmarks
      try {
        const bookmarksRaw = localStorage.getItem('compass_bookmarks');
        if (bookmarksRaw) {
          const localBookmarks = JSON.parse(bookmarksRaw);
          if (Array.isArray(localBookmarks) && localBookmarks.length > 0) {
            for (const book of localBookmarks) {
              try {
                await fetch('/api/bookmarks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ book }),
                });
              } catch { /* continue */ }
            }
            localStorage.removeItem('compass_bookmarks');
            didMigrate = true;
          }
        }
      } catch { /* ignore parse errors */ }

      // Refresh library if we migrated data
      if (didMigrate) {
        fetchLibrary();
      }
    };

    migrateData();
  }, [session?.access_token, user, fetchLibrary]);

  // Load hidden books from localStorage
  useEffect(() => {
    try {
      const hidden = localStorage.getItem('compass_hidden_books');
      if (hidden) setHiddenBooks(new Set(JSON.parse(hidden)));
    } catch { /* ignore */ }
  }, []);

  // ─── Actions ───
  const bookmarkedTitles = new Set(bookmarks.map(b => b.book_title));

  const handleBookmark = async (book: BookData) => {
    if (!session?.access_token) return;
    try {
      await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ book }),
      });
      fetchLibrary();
    } catch { /* ignore */ }
  };

  const handleRemoveBookmark = async (book: BookData) => {
    if (!session?.access_token) return;
    // Optimistic update
    setBookmarks(prev => prev.filter(b => b.book_title !== book.title || b.book_author !== book.author));
    try {
      await fetch('/api/bookmarks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ bookTitle: book.title, bookAuthor: book.author }),
      });
    } catch {
      fetchLibrary(); // Revert on error
    }
  };

  const handleHideBook = (book: BookData) => {
    const key = `${book.title}::${book.author}`;
    setHiddenBooks(prev => {
      const next = new Set(prev);
      next.add(key);
      try { localStorage.setItem('compass_hidden_books', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const getBookmarkForBook = (book: BookData): Bookmark | undefined => {
    return bookmarks.find(b => b.book_title === book.title && b.book_author === book.author);
  };

  // ─── Filter selections ───
  const filteredSelections = showBookmarkedOnly
    ? selections.filter(sel =>
        sel.books?.some(book =>
          bookmarkedTitles.has(book.title) && !hiddenBooks.has(`${book.title}::${book.author}`)
        )
      )
    : selections;

  // ─── Not logged in ───
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
            <Link href="/" className="block mt-6 text-sm" style={{ color: 'var(--color-text-dim)' }}>
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
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>本棚を開いています…</p>
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
          <div className="flex items-center justify-between mb-6">
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

          {/* Bookmark filter toggle */}
          <div className="mb-8">
            <button
              onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
              className="px-5 py-2.5 rounded-full text-xs font-bold transition-all"
              style={showBookmarkedOnly
                ? { background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))', color: '#fff', boxShadow: '0 2px 8px rgba(232, 101, 90, 0.25)' }
                : { color: 'var(--color-text-dim)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }
              }
            >
              🔖 しおりをはさんだ本だけ
            </button>
            {bookmarks.length > 0 && (
              <span className="text-[10px] ml-3" style={{ color: 'var(--color-text-dim)' }}>
                {bookmarks.length}冊のしおり
              </span>
            )}
          </div>

          {/* Timeline */}
          {filteredSelections.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-10">
              {filteredSelections.map(sel => (
                <TimelineBlock
                  key={sel.id}
                  selection={sel}
                  bookmarkedTitles={bookmarkedTitles}
                  hiddenBooks={hiddenBooks}
                  showBookmarkedOnly={showBookmarkedOnly}
                  onBookmark={handleBookmark}
                  onRemoveBookmark={handleRemoveBookmark}
                  onHide={handleHideBook}
                  onOpenModal={(book) => setModalBook({
                    book,
                    fragment: sel.fragments?.[0],
                    date: sel.created_at,
                  })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Book Detail Modal */}
      {modalBook && (
        <BookDetailModal
          book={modalBook.book}
          bookmark={getBookmarkForBook(modalBook.book)}
          fragment={modalBook.fragment}
          date={modalBook.date}
          isBookmarked={bookmarkedTitles.has(modalBook.book.title)}
          onClose={() => setModalBook(null)}
          onBookmark={() => { handleBookmark(modalBook.book); }}
          onRemoveBookmark={() => { handleRemoveBookmark(modalBook.book); }}
        />
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════════
   Timeline Block — One Selection (one note session)
   ═══════════════════════════════════════════════ */
function TimelineBlock({
  selection,
  bookmarkedTitles,
  hiddenBooks,
  showBookmarkedOnly,
  onBookmark,
  onRemoveBookmark,
  onHide,
  onOpenModal,
}: {
  selection: Selection;
  bookmarkedTitles: Set<string>;
  hiddenBooks: Set<string>;
  showBookmarkedOnly: boolean;
  onBookmark: (book: BookData) => void;
  onRemoveBookmark: (book: BookData) => void;
  onHide: (book: BookData) => void;
  onOpenModal: (book: BookData) => void;
}) {
  const visibleBooks = (selection.books || []).filter(book => {
    const key = `${book.title}::${book.author}`;
    if (hiddenBooks.has(key)) return false;
    if (showBookmarkedOnly && !bookmarkedTitles.has(book.title)) return false;
    return true;
  });

  if (visibleBooks.length === 0) return null;

  return (
    <div className="fade-in-up">
      {/* Date & Note info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--g-coral)' }} />
        <div className="flex-1">
          <p className="text-xs font-bold" style={{ color: 'var(--g-coral)' }}>
            {new Date(selection.created_at).toLocaleDateString('ja-JP', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
          {selection.note_title && (
            <h3 className="text-sm font-bold mt-0.5" style={{ color: 'var(--color-text)' }}>
              {selection.note_title}
            </h3>
          )}
        </div>
        {selection.note_url && (
          <a href={selection.note_url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] shrink-0 px-2 py-1 rounded-md"
            style={{ color: 'var(--color-accent)', background: 'rgba(208, 115, 74, 0.06)' }}>
            元のnote →
          </a>
        )}
      </div>

      {/* Fragment quote */}
      {selection.fragments && selection.fragments.length > 0 && (
        <div className="mb-5 ml-4 pl-3" style={{ borderLeft: '2px solid var(--g-coral)', opacity: 0.7 }}>
          <p className="text-xs italic leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            「{selection.fragments[0]}」
          </p>
        </div>
      )}

      {/* Books grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 ml-4">
        {visibleBooks.map((book, i) => {
          const isBookmarked = bookmarkedTitles.has(book.title);
          return (
            <div key={i} className="group relative">
              {/* Book card — tap opens modal */}
              <button
                onClick={() => onOpenModal(book)}
                className="card p-3 w-full text-left transition-all hover:shadow-md active:scale-[0.98]"
                style={{ cursor: 'pointer' }}
              >
                {/* Cover */}
                <div className="w-full aspect-[2/3] rounded-lg overflow-hidden shadow-sm mb-3 relative">
                  {book.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={book.thumbnail}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; const ph = (e.target as HTMLImageElement).nextElementSibling as HTMLElement; if (ph) ph.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div className="book-cover-placeholder" style={{ display: book.thumbnail ? 'none' : 'flex', position: 'absolute', inset: 0 }}>
                    <div className="book-cover-placeholder-inner">
                      <span className="book-cover-placeholder-title">{book.title}</span>
                      <span className="book-cover-placeholder-author">{book.author}</span>
                    </div>
                  </div>
                  {isBookmarked && (
                    <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
                      style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                      🔖
                    </div>
                  )}
                </div>

                {/* Label (eyecatch) */}
                {book.label && (
                  <p className="text-[10px] font-bold leading-tight mb-1" style={{
                    background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    {book.label}
                  </p>
                )}

                {/* Title & Author */}
                <h4 className="text-xs font-bold leading-tight mb-0.5" style={{ color: 'var(--color-text)' }}>
                  {book.title}
                </h4>
                <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                  {book.author}
                </p>
              </button>

              {/* Quick actions (visible on hover/tap) */}
              <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {!isBookmarked ? (
                  <button onClick={(e) => { e.stopPropagation(); onBookmark(book); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shadow-sm"
                    style={{ background: 'rgba(255,255,255,0.95)' }} title="しおりをはさむ">
                    🔖
                  </button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); onRemoveBookmark(book); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shadow-sm"
                    style={{ background: 'rgba(255,255,255,0.95)', color: 'var(--g-coral)' }} title="しおりをはずす">
                    ✓
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onHide(book); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shadow-sm"
                  style={{ background: 'rgba(255,255,255,0.95)', color: 'var(--color-text-dim)' }} title="そっと本棚から外す">
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Book Detail Modal — The Letter Experience
   「本棚から本を取り出すと、当時の手紙がしおりとして挟まっていた」
   ═══════════════════════════════════════════════ */
function BookDetailModal({
  book,
  bookmark,
  fragment,
  date,
  isBookmarked,
  onClose,
  onBookmark,
  onRemoveBookmark,
}: {
  book: BookData;
  bookmark?: Bookmark;
  fragment?: string;
  date?: string;
  isBookmarked: boolean;
  onClose: () => void;
  onBookmark: () => void;
  onRemoveBookmark: () => void;
}) {
  // Use bookmark data if available (has letter from DB), otherwise use book data
  const letter = bookmark?.book_letter || book.letter || '';
  const summary = bookmark?.book_summary || book.summary || '';
  const amazonUrl = bookmark?.book_amazon_url || book.amazonUrl || '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        style={{
          background: 'var(--color-surface)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
          style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--color-text-dim)' }}>
          ✕
        </button>

        {/* Cover & basic info */}
        <div className="p-6 pb-0">
          <div className="flex gap-5">
            {/* Cover image */}
            <div className="w-24 h-36 rounded-lg overflow-hidden shadow-md shrink-0 relative">
              {book.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={book.thumbnail}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; const ph = (e.target as HTMLImageElement).nextElementSibling as HTMLElement; if (ph) ph.style.display = 'flex'; }}
                />
              ) : null}
              <div className="book-cover-placeholder" style={{ display: book.thumbnail ? 'none' : 'flex', position: 'absolute', inset: 0 }}>
                <div className="book-cover-placeholder-inner">
                  <span className="book-cover-placeholder-title">{book.title}</span>
                  <span className="book-cover-placeholder-author">{book.author}</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {/* Label eyecatch */}
              {book.label && (
                <p className="text-xs font-bold mb-1.5 leading-tight" style={{
                  background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {book.label}
                </p>
              )}
              <h2 className="text-base font-extrabold leading-tight mb-1" style={{ color: 'var(--color-text)' }}>
                {book.title}
              </h2>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>
                {book.author}
              </p>

              {/* Bookmark toggle */}
              <button
                onClick={isBookmarked ? onRemoveBookmark : onBookmark}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-all"
                style={isBookmarked
                  ? { background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))', color: '#fff' }
                  : { background: 'rgba(208, 115, 74, 0.08)', color: 'var(--color-accent)' }
                }
              >
                {isBookmarked ? '🔖 しおりをはさみ中' : '🔖 しおりをはさむ'}
              </button>
            </div>
          </div>

          {/* Date context */}
          {date && (
            <p className="text-[10px] mt-4" style={{ color: 'var(--color-text-dim)' }}>
              {new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
              にこの本と出会いました
            </p>
          )}
        </div>

        {/* Fragment — 当時の自分の言葉 */}
        {fragment && (
          <div className="mx-6 mt-5 p-4 rounded-xl" style={{ background: 'rgba(208, 115, 74, 0.04)', borderLeft: '3px solid var(--g-coral)' }}>
            <p className="text-[10px] font-bold mb-1.5" style={{ color: 'var(--g-coral)' }}>
              あなたが当時書いた一節
            </p>
            <p className="text-xs italic leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              「{fragment}」
            </p>
          </div>
        )}

        {/* Letter — 手紙（しおりとして挟まっていた） */}
        {letter && (
          <div className="mx-6 mt-5 p-5 rounded-xl" style={{
            background: 'linear-gradient(135deg, rgba(208, 115, 74, 0.03), rgba(242, 168, 124, 0.06))',
            border: '1px solid rgba(208, 115, 74, 0.1)',
          }}>
            <p className="text-[10px] font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--g-coral)' }}>
              ✉️ あなた宛てのお手紙
            </p>
            <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
              {letter}
            </p>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="mx-6 mt-4">
            <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--color-text-dim)' }}>
              この本について
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {summary}
            </p>
          </div>
        )}

        {/* Amazon CTA — 感情が高まった状態で */}
        {amazonUrl && (
          <div className="p-6">
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(232, 101, 90, 0.3)',
              }}
            >
              📖 Amazonでこの本を迎え入れる
            </a>
            <p className="text-[9px] text-center mt-2" style={{ color: 'var(--color-text-dim)' }}>
              Amazonのページに移動します
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Auth Form
   ═══════════════════════════════════════════════ */
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
      <button onClick={() => signInWithGoogle()} className="btn-ghost w-full flex items-center justify-center gap-2 mb-4 py-3">
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Googleではじめる
      </button>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
        <span className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>または</span>
        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="email" className="input-field" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
        <input type="password" className="input-field" placeholder="パスワード（6文字以上）" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
        {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? '...' : mode === 'signup' ? '本棚をつくる（無料）' : 'ログインする'}
        </button>
      </form>
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

/* ═══════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════ */
function EmptyState() {
  return (
    <div className="py-20 text-center">
      <p className="text-sm leading-loose max-w-xs mx-auto"
        style={{ color: 'var(--color-text-dim)', fontStyle: 'italic' }}>
        まだここには何もありませんが、<br />
        あなたが言葉を紡ぐたび、<br />
        ここはあなただけの特別な場所になっていきます。
      </p>
    </div>
  );
}
