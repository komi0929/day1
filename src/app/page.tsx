'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

/* ─── Types ─── */
interface BookResult {
  title: string;
  author: string;
  isbn?: string;
  label: string;
  headline: string;
  oneliner: string;
  summary: string;
  letter: string;
  thumbnail: string;
  amazonUrl: string;
}

type AppPhase = 'input' | 'waiting' | 'results';

/* ─── Main Component ─── */
export default function Home() {
  const { user, session } = useAuth();
  const [phase, setPhase] = useState<AppPhase>('input');
  const [noteUrl, setNoteUrl] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Results — two-phase progressive loading
  const [allBooks, setAllBooks] = useState<BookResult[]>([]);
  const [fragments, setFragments] = useState<string[]>([]);
  const [phase2Loading, setPhase2Loading] = useState(false);
  const [phase2Loaded, setPhase2Loaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [bookmarkedTitles, setBookmarkedTitles] = useState<Set<string>>(new Set());
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Waiting screen animation
  const [currentFragment, setCurrentFragment] = useState(0);
  const [fragmentVisible, setFragmentVisible] = useState(false);

  // Ref to hold noteBody/noteTitle for phase 2 call
  const phase2DataRef = useRef<{ body: string; title: string }>({ body: '', title: '' });

  /* ─── URL submit handler ─── */
  const handleSubmit = useCallback(async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    setShowFallback(false);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: noteUrl.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'SCRAPE_FAILED' || data.error === 'FETCH_FAILED') {
          setShowFallback(true);
          setLoading(false);
          return;
        }
        throw new Error(data.message || 'うまくいきませんでした。もう一度お試しください。');
      }

      const data = await res.json();
      setNoteBody(data.body);
      setNoteTitle(data.title || '');
      startRecommendation(data.body, data.title || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'うまくいきませんでした。もう一度お試しください。');
      setLoading(false);
    }
  }, [noteUrl, loading]);

  /* ─── Fallback text submit ─── */
  const handleFallbackSubmit = useCallback(() => {
    if (!noteBody.trim() || noteBody.trim().length < 50) {
      setError('もう少しだけ文章を教えてください（50文字以上お願いします）');
      return;
    }
    startRecommendation(noteBody, noteTitle);
  }, [noteBody, noteTitle]);

  /* ─── Start recommendation process — Phase 1 (3 books) ─── */
  const startRecommendation = async (body: string, title: string) => {
    setPhase('waiting');
    setLoading(true);
    setError(null);
    setPhase2Loading(false);
    setPhase2Loaded(false);
    phase2DataRef.current = { body, title };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Phase 1: Get first 3 books (fast)
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers,
        body: JSON.stringify({ body, title, phase: 1 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'ごめんなさい、本を探せませんでした。もう一度お試しください。');
      }

      const data = await res.json();
      setAllBooks(data.books || []);
      setFragments(data.fragments || []);
      setCurrentPage(0);
      setExpandedCard(null);
      setPhase('results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ごめんなさい、本を探せませんでした。もう一度お試しください。');
      setPhase('input');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Phase 2: Load 6 more books in background ─── */
  const loadMoreBooks = useCallback(async () => {
    if (phase2Loading || phase2Loaded) return;
    setPhase2Loading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const { body, title } = phase2DataRef.current;
      const excludeTitles = allBooks.map(b => b.title);

      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers,
        body: JSON.stringify({ body, title, phase: 2, excludeTitles }),
      });

      if (res.ok) {
        const data = await res.json();
        const newBooks: BookResult[] = data.books || [];
        setAllBooks(prev => [...prev, ...newBooks]);
      }
    } catch {
      // Non-critical — phase 2 is best-effort
    } finally {
      setPhase2Loading(false);
      setPhase2Loaded(true);
    }
  }, [phase2Loading, phase2Loaded, allBooks, session?.access_token]);

  /* ─── Save selection & trigger heart profile (for logged-in users) ─── */
  useEffect(() => {
    if (phase !== 'results' || allBooks.length === 0) return;
    if (!session?.access_token) {
      try {
        const pending = JSON.parse(localStorage.getItem('compass_pending') || '[]');
        pending.push({ noteUrl, noteTitle, noteBody: noteBody.slice(0, 500), books: allBooks, fragments, ts: Date.now() });
        localStorage.setItem('compass_pending', JSON.stringify(pending.slice(-5)));
      } catch { /* ignore */ }
      return;
    }
    const saveAndProfile = async () => {
      try {
        const saveRes = await fetch('/api/save-selection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ noteUrl, noteTitle, noteBody: noteBody.slice(0, 500), books: allBooks, fragments }),
        });
        const saveData = await saveRes.json();
        fetch('/api/heart-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ noteUrl, noteTitle, noteBody, selectionId: saveData.selectionId }),
        }).catch(() => {});
      } catch { /* non-critical */ }
    };
    saveAndProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ─── Bookmark handler ─── */
  const handleBookmark = useCallback(async (book: BookResult) => {
    if (!session?.access_token) {
      try {
        const saved = JSON.parse(localStorage.getItem('compass_bookmarks') || '[]');
        if (!saved.find((b: BookResult) => b.title === book.title && b.author === book.author)) {
          saved.push(book);
          localStorage.setItem('compass_bookmarks', JSON.stringify(saved));
        }
      } catch { /* ignore */ }
      setBookmarkedTitles(prev => new Set(prev).add(book.title));
      setShowSignupModal(true);
      return;
    }
    setBookmarkedTitles(prev => new Set(prev).add(book.title));
    try {
      await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ book }),
      });
    } catch { /* non-critical */ }
  }, [session?.access_token]);

  /* ─── Fragment rotation for waiting screen ─── */
  useEffect(() => {
    if (phase !== 'waiting' || fragments.length === 0) return;
    setFragmentVisible(true);
    const interval = setInterval(() => {
      setFragmentVisible(false);
      setTimeout(() => {
        setCurrentFragment(prev => (prev + 1) % fragments.length);
        setFragmentVisible(true);
      }, 1200);
    }, 5000);
    return () => clearInterval(interval);
  }, [phase, fragments.length]);

  /* ─── Pre-extract fragments during scrape ─── */
  useEffect(() => {
    if (phase === 'waiting' && fragments.length === 0 && noteBody) {
      const sentences = noteBody
        .split(/[。！？\n]/)
        .map(s => s.trim())
        .filter(s => s.length >= 15 && s.length <= 80);
      const shuffled = sentences.sort(() => Math.random() - 0.5).slice(0, 6);
      if (shuffled.length > 0) setFragments(shuffled);
    }
  }, [phase, noteBody, fragments.length]);

  /* ─── Pagination ─── */
  const booksPerPage = 3;
  const totalPages = Math.ceil(allBooks.length / booksPerPage);
  const currentBooks = allBooks.slice(
    currentPage * booksPerPage,
    (currentPage + 1) * booksPerPage
  );
  const isOnLastPage = currentPage >= totalPages - 1;

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
      setExpandedCard(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      setExpandedCard(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /* ─── "他の本を探す" → triggers phase 2 background load ─── */
  const handleExploreMore = () => {
    if (!phase2Loaded && !phase2Loading) {
      // Start loading phase 2 and immediately show next page when ready
      loadMoreBooks();
    } else if (phase2Loaded && allBooks.length > (currentPage + 1) * booksPerPage) {
      // Phase 2 already loaded, just go to next page
      handleNextPage();
    }
  };

  // When phase2 loads and user was waiting, auto-advance to new page
  useEffect(() => {
    if (phase2Loaded && allBooks.length > 3 && currentPage === 0 && isOnLastPage) {
      // After phase2 loads, auto-advance to page 2 if user is still on page 1
      setCurrentPage(1);
      setExpandedCard(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase2Loaded, allBooks.length]);

  const handleReset = () => {
    setPhase('input');
    setNoteUrl('');
    setNoteBody('');
    setNoteTitle('');
    setShowFallback(false);
    setAllBooks([]);
    setFragments([]);
    setPhase2Loading(false);
    setPhase2Loaded(false);
    setCurrentPage(0);
    setExpandedCard(null);
    setError(null);
    setLoading(false);
    setCurrentFragment(0);
  };

  return (
    <div className="gradient-warm min-h-dvh">
      {/* ═══ INPUT PHASE ═══ */}
      {phase === 'input' && (
        <main className="min-h-dvh">
          <section className="flex items-center justify-center px-4 pt-20 pb-12 md:pt-28 md:pb-16">
            <div className="max-w-lg w-full text-center">
              <div className="mb-10 fade-in-up">
                {/* Compass SVG icon */}
                <div className="mx-auto mb-5 w-14 h-14 flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="24" cy="24" r="22" stroke="url(#compassGrad)" strokeWidth="2.5" opacity="0.7" />
                    <circle cx="24" cy="24" r="17" stroke="url(#compassGrad)" strokeWidth="1.2" opacity="0.35" />
                    <line x1="24" y1="2" x2="24" y2="7" stroke="url(#compassGrad)" strokeWidth="2" strokeLinecap="round" />
                    <line x1="24" y1="41" x2="24" y2="46" stroke="url(#compassGrad)" strokeWidth="2" strokeLinecap="round" />
                    <line x1="2" y1="24" x2="7" y2="24" stroke="url(#compassGrad)" strokeWidth="2" strokeLinecap="round" />
                    <line x1="41" y1="24" x2="46" y2="24" stroke="url(#compassGrad)" strokeWidth="2" strokeLinecap="round" />
                    <polygon points="24,8 21,24 27,24" fill="url(#compassGrad)" />
                    <polygon points="24,40 21,24 27,24" fill="rgba(44,37,32,0.18)" />
                    <circle cx="24" cy="24" r="2.5" fill="url(#compassGrad)" />
                    <defs>
                      <linearGradient id="compassGrad" x1="8" y1="8" x2="40" y2="40">
                        <stop offset="0%" stopColor="#E8655A" />
                        <stop offset="100%" stopColor="#F2A87C" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-gradient tracking-tight mb-4">
                  compass
                </h1>
                <p className="text-sm leading-[1.9] max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                  あなたの書いたnoteから<strong style={{ color: 'var(--g-coral)' }}>「今読んでほしい一冊」</strong>をおすすめするアプリ。<br />
                  URLをひとつ入れるだけで、悩みや願いを読み解き、<br />
                  あなたの背中をそっと押してくれる本を、お手紙とともにお届けします。
                </p>
              </div>

              <div className="fade-in-up" style={{ animationDelay: '0.15s' }}>
                <div className="card p-4 mb-4">
                  <input
                    id="note-url-input"
                    type="url"
                    className="input-field w-full"
                    placeholder="あなたのnoteのURLを教えてください"
                    value={noteUrl}
                    onChange={e => setNoteUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && noteUrl.trim()) handleSubmit(); }}
                    disabled={loading}
                  />
                </div>
                <button
                  id="submit-button"
                  onClick={handleSubmit}
                  disabled={!noteUrl.trim() || loading}
                  className="btn-primary w-full"
                >
                  {loading ? (
                    <span className="analyzing-pulse">お手紙を準備しています…</span>
                  ) : (
                    '本とお手紙を受け取る'
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 text-xs rounded-lg text-left" style={{
                  background: 'rgba(232, 101, 90, 0.08)',
                  color: 'var(--color-danger)',
                  border: '1px solid rgba(232, 101, 90, 0.15)',
                }}>
                  {error}
                </div>
              )}

              {showFallback && (
                <div className="mt-6 fade-in-up text-left" style={{ animationDelay: '0.1s' }}>
                  <div className="p-3 text-xs rounded-lg mb-4" style={{
                    background: 'rgba(232, 197, 71, 0.08)',
                    color: 'var(--color-text)',
                    border: '1px solid rgba(232, 197, 71, 0.20)',
                  }}>
                    ごめんなさい、うまく読み取れませんでした。お手数ですが、こちらに直接文章を教えてもらえませんか？
                  </div>
                  <textarea
                    id="fallback-textarea"
                    className="textarea-auto w-full mb-3"
                    placeholder="ここにnoteの文章を貼り付けてください"
                    value={noteBody}
                    onChange={e => setNoteBody(e.target.value)}
                    rows={8}
                  />
                  <button
                    id="fallback-submit"
                    onClick={handleFallbackSubmit}
                    disabled={noteBody.trim().length < 50 || loading}
                    className="btn-primary w-full"
                  >
                    この文章で本を探す
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="px-4 pb-16">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-center text-xs font-bold tracking-[3px] uppercase mb-8" style={{ color: 'var(--color-text-dim)' }}>
                使い方
              </h2>
              <div className="how-steps">
                <div className="how-step fade-in-up" style={{ animationDelay: '0.1s' }}>
                  <div className="how-step-num">1</div>
                  <div>
                    <h3 className="how-step-title">noteのURLをひとつ</h3>
                    <p className="how-step-desc">あなたが書いたnoteの記事URLを教えてください。悩み、考えごと、日記——どんな記事でも大丈夫です。</p>
                  </div>
                </div>
                <div className="how-step fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="how-step-num">2</div>
                  <div>
                    <h3 className="how-step-title">言葉をじっくり読む</h3>
                    <p className="how-step-desc">あなたの文章の行間から、悩みや願い、まだ言葉にできていない想いを丁寧に読み解きます。30秒ほど、あなたの言葉が静かに画面に浮かびます。</p>
                  </div>
                </div>
                <div className="how-step fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <div className="how-step-num">3</div>
                  <div>
                    <h3 className="how-step-title">一冊と出会う</h3>
                    <p className="how-step-desc">あなたのために選ばれた本が、お手紙とともに届きます。なぜこの本なのか——その理由は、あなたの言葉の中にあります。</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="border-t px-4 py-8 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-center gap-6 text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
              <Link href="/terms" className="hover:underline" style={{ color: 'var(--color-text-dim)' }}>利用規約</Link>
              <Link href="/privacy" className="hover:underline" style={{ color: 'var(--color-text-dim)' }}>プライバシーポリシー</Link>
            </div>
            <p className="mt-4 text-[10px]" style={{ color: 'var(--color-text-dim)', opacity: 0.6 }}>
              © 2026 株式会社ヒトコト
            </p>
          </footer>
        </main>
      )}

      {/* ═══ WAITING PHASE ═══ */}
      {phase === 'waiting' && (
        <main className="min-h-dvh flex items-center justify-center px-6">
          <div className="max-w-lg w-full text-center">
            <div className="mb-8">
              <div className="book-pulse mx-auto mb-8">
                <div className="book-spine" />
              </div>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                あなたのための一冊をじっくり探しています
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                30秒ほど、ゆっくりとお待ちください
              </p>
            </div>
            <div className="fragment-container">
              {fragments.length > 0 && (
                <p className={`fragment-text ${fragmentVisible ? 'fragment-visible' : 'fragment-hidden'}`}>
                  「{fragments[currentFragment]}」
                </p>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ═══ RESULTS PHASE ═══ */}
      {phase === 'results' && (
        <ResultsView
          books={currentBooks}
          currentPage={currentPage}
          totalPages={totalPages}
          isOnLastPage={isOnLastPage}
          phase2Loading={phase2Loading}
          phase2Loaded={phase2Loaded}
          expandedCard={expandedCard}
          setExpandedCard={setExpandedCard}
          handleNextPage={handleNextPage}
          handlePrevPage={handlePrevPage}
          handleExploreMore={handleExploreMore}
          handleReset={handleReset}
          bookmarkedTitles={bookmarkedTitles}
          handleBookmark={handleBookmark}
          showSignupModal={showSignupModal}
          setShowSignupModal={setShowSignupModal}
          user={user}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Results View Component
   ═══════════════════════════════════════════════ */

function ResultsView({
  books, currentPage, totalPages, isOnLastPage,
  phase2Loading, phase2Loaded,
  expandedCard, setExpandedCard, handleNextPage, handlePrevPage,
  handleExploreMore, handleReset,
  bookmarkedTitles, handleBookmark, showSignupModal, setShowSignupModal, user,
}: {
  books: BookResult[];
  currentPage: number;
  totalPages: number;
  isOnLastPage: boolean;
  phase2Loading: boolean;
  phase2Loaded: boolean;
  expandedCard: number | null;
  setExpandedCard: (i: number | null) => void;
  handleNextPage: () => void;
  handlePrevPage: () => void;
  handleExploreMore: () => void;
  handleReset: () => void;
  bookmarkedTitles: Set<string>;
  handleBookmark: (book: BookResult) => void;
  showSignupModal: boolean;
  setShowSignupModal: (v: boolean) => void;
  user: { id: string } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 80 && currentPage < totalPages - 1) handleNextPage();
    if (diff < -80 && currentPage > 0) handlePrevPage();
    setTouchStart(null);
  };

  return (
    <main className="min-h-dvh pb-24">
      <header className="pt-10 pb-6 px-6 text-center">
        {/* Show page indicator when multiple pages exist */}
        {totalPages > 1 && (
          <p className="text-[10px] font-bold tracking-[3px] uppercase mb-2" style={{ color: 'var(--color-text-dim)' }}>
            {currentPage + 1} / {totalPages}
          </p>
        )}
        <h2 className="text-xl font-bold text-gradient">あなたへのお手紙と一冊</h2>
      </header>

      <div ref={containerRef} className="result-grid px-4 md:px-8"
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      >
        {books.map((book, i) => (
          <BookCard key={`${currentPage}-${i}`} book={book} index={i}
            isExpanded={expandedCard === i}
            onToggle={() => setExpandedCard(expandedCard === i ? null : i)}
            isBookmarked={bookmarkedTitles.has(book.title)}
            onBookmark={() => handleBookmark(book)}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="px-6 mt-8 max-w-lg mx-auto space-y-3">
        {/* Page navigation arrows */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mb-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className="btn-ghost px-4 py-2 text-sm"
              style={{ opacity: currentPage === 0 ? 0.3 : 1 }}
            >
              ← 前へ
            </button>
            <span className="text-xs font-bold tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={isOnLastPage}
              className="btn-ghost px-4 py-2 text-sm"
              style={{ opacity: isOnLastPage ? 0.3 : 1 }}
            >
              次へ →
            </button>
          </div>
        )}

        {/* "他の本を探す" — triggers phase 2 load */}
        {isOnLastPage && !phase2Loaded && (
          <button
            id="load-more-button"
            onClick={handleExploreMore}
            disabled={phase2Loading}
            className="btn-ghost w-full"
          >
            {phase2Loading ? (
              <span className="analyzing-pulse">他の本を探しています…</span>
            ) : (
              '他の本を探す →'
            )}
          </button>
        )}

        {/* End message: all books loaded and on last page */}
        {phase2Loaded && isOnLastPage && (
          <div className="text-center fade-in-up">
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
              今回はここまで。<br />また別のnoteを書かれたら、いつでもここへいらしてくださいね。<br />あなたを導く羅針盤となる本を、一緒にお探しします。
            </p>
            <button id="restart-button" onClick={handleReset} className="btn-primary w-full max-w-xs mx-auto">
              別のnoteで本を探す
            </button>
          </div>
        )}
      </div>

      {/* Signup Modal */}
      {showSignupModal && !user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(44,37,32,0.4)', backdropFilter: 'blur(8px)' }}>
          <div className="card p-8 max-w-sm w-full text-center fade-in-up">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-sm leading-loose mb-6" style={{ color: 'var(--color-text)' }}>
              このお手紙と本を、あなた専用の本棚にそっとしまっておきませんか？<br />
              次にお会いした時、また続きのお話ができるように。
            </p>
            <Link href="/library" className="btn-primary block w-full mb-3 text-center py-3">
              本棚をつくる（無料）
            </Link>
            <button onClick={() => setShowSignupModal(false)} className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              あとで
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════════
   Book Card Component
   ═══════════════════════════════════════════════ */

function BookCard({ book, index, isExpanded, onToggle, isBookmarked, onBookmark }: {
  book: BookResult; index: number; isExpanded: boolean; onToggle: () => void;
  isBookmarked: boolean; onBookmark: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const hasThumbnail = book.thumbnail && book.thumbnail !== '';

  return (
    <article className="book-card fade-in-up" style={{ animationDelay: `${index * 0.12}s` }}>
      <div className="book-cover-wrapper">
        <div className="book-cover-shadow" />
        {hasThumbnail && !imgError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={book.thumbnail}
            alt={`${book.title} 表紙`}
            className="book-cover-img"
            onError={() => setImgError(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="book-cover-placeholder">
            <div className="book-cover-placeholder-inner">
              <span className="book-cover-placeholder-title">{book.title}</span>
              <span className="book-cover-placeholder-author">{book.author}</span>
            </div>
          </div>
        )}
      </div>

      <div className="book-label">{book.label}</div>
      <h3 className="book-title">{book.title}</h3>
      <p className="book-author">{book.author}</p>
      <p className="book-headline">{book.headline}</p>
      <p className="book-oneliner">「{book.oneliner}」</p>

      <button
        onClick={onBookmark}
        className="book-expand-btn mb-2"
        style={isBookmarked ? { color: 'var(--g-coral)', borderColor: 'rgba(232,101,90,0.3)' } : {}}
      >
        {isBookmarked ? '✅ しおりをはさみました' : '🔖 しおりをはさむ'}
      </button>

      <button onClick={onToggle} className="book-expand-btn">
        {isExpanded ? '閉じる' : 'お手紙を読む'}
        <span className="expand-arrow" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      {isExpanded && (
        <div className="book-details fade-in-up">
          <div className="book-detail-section">
            <h4 className="book-detail-label">この本について</h4>
            <p className="book-detail-text">{book.summary}</p>
          </div>
          <div className="book-detail-section book-letter">
            <h4 className="book-detail-label">📝 あなたへの手紙</h4>
            <p className="book-letter-text">{book.letter}</p>
          </div>
        </div>
      )}

      <a href={book.amazonUrl} target="_blank" rel="noopener noreferrer" className="book-amazon-link">
        Amazonで見る →
      </a>
    </article>
  );
}
