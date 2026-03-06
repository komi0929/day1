'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { track, startTimer } from '@/lib/analytics';

/* ─── Types ─── */
interface BookResult {
  title: string;
  author: string;
  isbn?: string;
  label: string;
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

  // Results — progressive 3-book batches
  const [bookBatches, setBookBatches] = useState<BookResult[][]>([]); // Array of 3-book batches
  const [fragments, setFragments] = useState<string[]>([]);
  const [currentBatch, setCurrentBatch] = useState(0); // Which batch to show
  const [searchingMore, setSearchingMore] = useState(false); // Is phase 2/3 loading?
  const [maxBatches] = useState(3); // Max 3 batches = 9 books
  const [expandedLetter, setExpandedLetter] = useState<number | null>(null);
  const [bookmarkedTitles, setBookmarkedTitles] = useState<Set<string>>(new Set());
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showHomeWarning, setShowHomeWarning] = useState(false);

  // Swipe state within a batch
  const [currentCard, setCurrentCard] = useState(0);

  // Waiting screen
  const [currentFragment, setCurrentFragment] = useState(0);
  const [fragmentVisible, setFragmentVisible] = useState(false);

  // Phase 2/3 data ref
  const noteDataRef = useRef<{ body: string; title: string }>({ body: '', title: '' });

  /* ─── API call helper ─── */
  const fetchBooks = useCallback(async (body: string, title: string, excludeTitles: string[], includeFragments: boolean): Promise<{ books: BookResult[]; fragments: string[] } | null> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers,
        body: JSON.stringify({ body, title, excludeTitles, includeFragments }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'エラーが発生しました');
      }
      return await res.json();
    } catch (err) {
      console.error('Fetch books error:', err);
      return null;
    }
  }, [session?.access_token]);

  /* ─── page_view tracking ─── */
  useEffect(() => { track('page_view'); }, []);

  /* ─── URL submit handler ─── */
  const handleSubmit = useCallback(async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    setShowFallback(false);
    track('url_submit', { url_domain: noteUrl.trim().replace(/https?:\/\//, '').split('/')[0] });

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
        throw new Error(data.message || 'うまくいきませんでした。');
      }

      const data = await res.json();
      setNoteBody(data.body);
      setNoteTitle(data.title || '');
      startRecommendation(data.body, data.title || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'うまくいきませんでした。');
      setLoading(false);
    }
  }, [noteUrl, loading]);

  /* ─── Fallback text submit ─── */
  const handleFallbackSubmit = useCallback(() => {
    if (!noteBody.trim() || noteBody.trim().length < 50) {
      setError('もう少しだけ文章を教えてください（50文字以上お願いします）');
      return;
    }
    track('url_fallback', { body_length: noteBody.trim().length });
    startRecommendation(noteBody, noteTitle);
  }, [noteBody, noteTitle]);

  /* ─── Phase 1: Get first 3 books ─── */
  const startRecommendation = async (body: string, title: string) => {
    setPhase('waiting');
    setLoading(true);
    setError(null);
    noteDataRef.current = { body, title };
    setBookBatches([]);
    setCurrentBatch(0);
    setCurrentCard(0);

    track('recommend_start', { phase: 1, excludeCount: 0 });
    const timer = startTimer();
    const result = await fetchBooks(body, title, [], true);
    if (result && result.books.length > 0) {
      const thumbnailHits = result.books.filter((b: BookResult) => b.thumbnail).length;
      track('recommend_complete', { phase: 1, bookCount: result.books.length, durationMs: timer(), thumbnailHits });
      setBookBatches([result.books]);
      setFragments(result.fragments || []);
      setCurrentBatch(0);
      setCurrentCard(0);
      setExpandedLetter(null);
      setPhase('results');
    } else {
      track('recommend_error', { phase: 1, errorType: 'empty_result' });
      setError('ごめんなさい、本を探せませんでした。もう一度お試しください。');
      setPhase('input');
    }
    setLoading(false);
  };

  /* ─── Load next 3 books ─── */
  const loadNextBatch = useCallback(async (isBackgroundPreload: boolean = false) => {
    if (searchingMore || bookBatches.length >= maxBatches) return;
    setSearchingMore(true);
    track('load_more', { currentBatchCount: bookBatches.length });

    const { body, title } = noteDataRef.current;
    const allExisting = bookBatches.flat().map(b => b.title);

    const timer = startTimer();
    track('recommend_start', { phase: bookBatches.length + 1, excludeCount: allExisting.length });
    const result = await fetchBooks(body, title, allExisting, false);
    if (result && result.books.length > 0) {
      const thumbnailHits = result.books.filter((b: BookResult) => b.thumbnail).length;
      track('recommend_complete', { phase: bookBatches.length + 1, bookCount: result.books.length, durationMs: timer(), thumbnailHits });
      setBookBatches(prev => {
        const newBatches = [...prev, result.books];
        if (!isBackgroundPreload) {
          // Auto-navigate only if user actively clicked
          setCurrentBatch(newBatches.length - 1);
          setCurrentCard(0);
          setExpandedLetter(null);
        }
        return newBatches;
      });
    }
    setSearchingMore(false);
  }, [searchingMore, bookBatches, maxBatches, fetchBooks]);

  /* ─── Save selection ─── */
  useEffect(() => {
    if (phase !== 'results' || bookBatches.length === 0) return;
    const allBooks = bookBatches.flat();
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

  /* ─── Background Pre-fetch Next Batch ─── */
  useEffect(() => {
    // If we are viewing the latest loaded batch, and we haven't reached maxBatches, start prefetching the next batch
    if (phase === 'results' && currentBatch === bookBatches.length - 1 && bookBatches.length < maxBatches && !searchingMore) {
      loadNextBatch(true); // Pre-fetch in background without auto-navigating
    }
  }, [phase, currentBatch, bookBatches.length, searchingMore, loadNextBatch]);

  /* ─── Bookmark handler ─── */
  const handleBookmark = useCallback(async (book: BookResult) => {
    track('bookmark_tap', { bookTitle: book.title, isLoggedIn: !!session?.access_token });
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
      track('signup_modal_show');
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

  /* ─── Fragment rotation ─── */
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

  useEffect(() => {
    if (phase === 'waiting' && fragments.length === 0 && noteBody) {
      const sentences = noteBody.split(/[。！？\n]/).map(s => s.trim()).filter(s => s.length >= 15 && s.length <= 80);
      const shuffled = sentences.sort(() => Math.random() - 0.5).slice(0, 6);
      if (shuffled.length > 0) setFragments(shuffled);
    }
  }, [phase, noteBody, fragments.length]);

  /* ─── Home navigation with warning ─── */
  const handleGoHome = () => {
    if (phase === 'results' && !user) {
      setShowHomeWarning(true);
      track('home_warning_show');
    } else {
      doReset();
    }
  };

  const doReset = () => {
    setPhase('input');
    setNoteUrl('');
    setNoteBody('');
    setNoteTitle('');
    setShowFallback(false);
    setBookBatches([]);
    setFragments([]);
    setCurrentBatch(0);
    setCurrentCard(0);
    setExpandedLetter(null);
    setError(null);
    setLoading(false);
    setCurrentFragment(0);
    setSearchingMore(false);
    setShowHomeWarning(false);
    setShowSignupModal(false);
  };

  /* ─── Current batch data ─── */
  const currentBooks = bookBatches[currentBatch] || [];
  const canLoadMore = bookBatches.length < maxBatches;
  const hasNextBatch = currentBatch < bookBatches.length - 1;
  const hasPrevBatch = currentBatch > 0;

  return (
    <div className="gradient-warm min-h-dvh">
      {/* ═══ FIXED HEADER — always visible ═══ */}
      {phase !== 'input' && (
        <header className="fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center"
          style={{ background: 'rgba(253, 246, 238, 0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)' }}
        >
          <button onClick={handleGoHome} className="flex items-center gap-2 text-sm font-bold text-gradient" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="url(#chg)" strokeWidth="2.5" opacity="0.7" />
              <polygon points="24,8 21,24 27,24" fill="url(#chg)" />
              <polygon points="24,40 21,24 27,24" fill="rgba(44,37,32,0.18)" />
              <circle cx="24" cy="24" r="2" fill="url(#chg)" />
              <defs><linearGradient id="chg" x1="8" y1="8" x2="40" y2="40"><stop offset="0%" stopColor="#E8655A" /><stop offset="100%" stopColor="#F2A87C" /></linearGradient></defs>
            </svg>
            compass
          </button>
        </header>
      )}

      {/* ═══ INPUT PHASE ═══ */}
      {phase === 'input' && (
        <main className="min-h-dvh">
          <section className="flex items-center justify-center px-4 pt-20 pb-12 md:pt-28 md:pb-16">
            <div className="max-w-lg w-full text-center">
              <div className="mb-10 fade-in-up">
                <div className="mx-auto mb-5 w-14 h-14 flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" stroke="url(#cg)" strokeWidth="2.5" opacity="0.7" />
                    <circle cx="24" cy="24" r="17" stroke="url(#cg)" strokeWidth="1.2" opacity="0.35" />
                    <line x1="24" y1="2" x2="24" y2="7" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" />
                    <line x1="24" y1="41" x2="24" y2="46" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" />
                    <line x1="2" y1="24" x2="7" y2="24" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" />
                    <line x1="41" y1="24" x2="46" y2="24" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" />
                    <polygon points="24,8 21,24 27,24" fill="url(#cg)" />
                    <polygon points="24,40 21,24 27,24" fill="rgba(44,37,32,0.18)" />
                    <circle cx="24" cy="24" r="2.5" fill="url(#cg)" />
                    <defs><linearGradient id="cg" x1="8" y1="8" x2="40" y2="40"><stop offset="0%" stopColor="#E8655A" /><stop offset="100%" stopColor="#F2A87C" /></linearGradient></defs>
                  </svg>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-gradient tracking-tight mb-4">compass</h1>
                <p className="text-sm leading-[1.9] max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                  あなたの書いたnoteから<strong style={{ color: 'var(--g-coral)' }}>「今読んでほしい一冊」</strong>をおすすめするアプリ。<br />
                  URLをひとつ入れるだけで、悩みや願いを読み解き、<br />
                  あなたの背中をそっと押してくれる本を、お手紙とともにお届けします。
                </p>
              </div>

              <div className="fade-in-up" style={{ animationDelay: '0.15s' }}>
                <div className="card p-4 mb-4">
                  <input id="note-url-input" type="url" className="input-field w-full" placeholder="あなたのnoteのURLを教えてください"
                    value={noteUrl} onChange={e => setNoteUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && noteUrl.trim()) handleSubmit(); }} disabled={loading}
                  />
                </div>
                <button id="submit-button" onClick={handleSubmit} disabled={!noteUrl.trim() || loading} className="btn-primary w-full">
                  {loading ? <span className="analyzing-pulse">お手紙を準備しています…</span> : '本とお手紙を受け取る'}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 text-xs rounded-lg text-left" style={{ background: 'rgba(232, 101, 90, 0.08)', color: 'var(--color-danger)', border: '1px solid rgba(232, 101, 90, 0.15)' }}>
                  {error}
                </div>
              )}

              {showFallback && (
                <div className="mt-6 fade-in-up text-left" style={{ animationDelay: '0.1s' }}>
                  <div className="p-3 text-xs rounded-lg mb-4" style={{ background: 'rgba(232, 197, 71, 0.08)', color: 'var(--color-text)', border: '1px solid rgba(232, 197, 71, 0.20)' }}>
                    ごめんなさい、うまく読み取れませんでした。お手数ですが、こちらに直接文章を教えてもらえませんか？
                  </div>
                  <textarea id="fallback-textarea" className="textarea-auto w-full mb-3" placeholder="ここにnoteの文章を貼り付けてください"
                    value={noteBody} onChange={e => setNoteBody(e.target.value)} rows={8} />
                  <button id="fallback-submit" onClick={handleFallbackSubmit} disabled={noteBody.trim().length < 50 || loading} className="btn-primary w-full">
                    この文章で本を探す
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="px-4 pb-16">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-center text-xs font-bold tracking-[3px] uppercase mb-8" style={{ color: 'var(--color-text-dim)' }}>使い方</h2>
              <div className="how-steps">
                {[
                  { n: '1', t: 'noteのURLをひとつ', d: 'あなたが書いたnoteの記事URLを教えてください。悩み、考えごと、日記——どんな記事でも大丈夫です。' },
                  { n: '2', t: '言葉をじっくり読む', d: 'あなたの文章の行間から、悩みや願い、まだ言葉にできていない想いを丁寧に読み解きます。' },
                  { n: '3', t: '一冊と出会う', d: 'あなたのために選ばれた本が、お手紙とともに届きます。なぜこの本なのか——その理由は、あなたの言葉の中にあります。' },
                ].map((s, i) => (
                  <div key={i} className="how-step fade-in-up" style={{ animationDelay: `${(i + 1) * 0.1}s` }}>
                    <div className="how-step-num">{s.n}</div>
                    <div><h3 className="how-step-title">{s.t}</h3><p className="how-step-desc">{s.d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <footer className="border-t px-4 py-8 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-center gap-6 text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
              <Link href="/terms" className="hover:underline" style={{ color: 'var(--color-text-dim)' }}>利用規約</Link>
              <Link href="/privacy" className="hover:underline" style={{ color: 'var(--color-text-dim)' }}>プライバシーポリシー</Link>
            </div>
            <p className="mt-4 text-[10px]" style={{ color: 'var(--color-text-dim)', opacity: 0.6 }}>© 2026 株式会社ヒトコト</p>
          </footer>
        </main>
      )}

      {/* ═══ WAITING PHASE ═══ */}
      {phase === 'waiting' && (
        <main className="min-h-dvh flex items-center justify-center px-6 pt-14">
          <div className="max-w-lg w-full text-center">
            <div className="mb-8">
              <div className="book-pulse mx-auto mb-8"><div className="book-spine" /></div>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>あなたのための一冊をじっくり探しています</p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>30秒ほど、ゆっくりとお待ちください</p>
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
        <main className="min-h-dvh pt-16 pb-24">
          <header className="pt-4 pb-4 px-6 text-center">
            <h2 className="text-lg font-bold text-gradient">あなたへのお手紙と一冊</h2>
          </header>

          {/* ─── Card Carousel (swipe within batch) ─── */}
          <CardCarousel
            books={currentBooks}
            currentCard={currentCard}
            setCurrentCard={setCurrentCard}
            expandedLetter={expandedLetter}
            setExpandedLetter={setExpandedLetter}
            bookmarkedTitles={bookmarkedTitles}
            handleBookmark={handleBookmark}
          />

          {/* ─── Batch indicator dots ─── */}
          {currentBooks.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {currentBooks.map((_, i) => (
                <button key={i} onClick={() => { setCurrentCard(i); setExpandedLetter(null); }}
                  className="w-2 h-2 rounded-full transition-all duration-300"
                  style={{ background: i === currentCard ? 'var(--g-coral)' : 'rgba(44,37,32,0.15)', transform: i === currentCard ? 'scale(1.3)' : 'scale(1)' }}
                />
              ))}
            </div>
          )}

          {/* ─── Batch navigation ─── */}
          <div className="px-6 mt-6 max-w-lg mx-auto space-y-3">
            {/* Batch prev/next */}
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => { setCurrentBatch(prev => prev - 1); setCurrentCard(0); setExpandedLetter(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={!hasPrevBatch} className="btn-ghost px-4 py-2 text-sm" style={{ opacity: hasPrevBatch ? 1 : 0.3 }}>
                ← 前の3冊
              </button>
              <span className="text-xs font-bold tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                {currentBatch + 1} / {bookBatches.length}
              </span>
              <button onClick={() => { setCurrentBatch(prev => prev + 1); setCurrentCard(0); setExpandedLetter(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={!hasNextBatch} className="btn-ghost px-4 py-2 text-sm" style={{ opacity: hasNextBatch ? 1 : 0.3 }}>
                次の3冊 →
              </button>
            </div>

            {/* Load more button — only on last batch */}
            {!hasNextBatch && canLoadMore && (
              <button id="load-more-button" onClick={() => loadNextBatch(false)} disabled={searchingMore} className="btn-ghost w-full">
                {searchingMore ? (
                  <span className="analyzing-pulse">📚 {bookBatches.length * 3 + 1}冊目以降を探しています…</span>
                ) : (
                  `他の本を探す（${bookBatches.length * 3 + 1}冊目〜） →`
                )}
              </button>
            )}

            {/* Searching indicator (also shown if searching and user navigated away) */}
            {searchingMore && hasNextBatch && (
              <p className="text-center text-xs analyzing-pulse" style={{ color: 'var(--color-text-dim)' }}>
                📚 さらにあなたのための本を探しています…
              </p>
            )}

            {/* End message */}
            {!canLoadMore && !hasNextBatch && (
              <div className="text-center fade-in-up">
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
                  今回はここまで。<br />また別のnoteを書かれたら、いつでもここへいらしてくださいね。<br />あなたを導く羅針盤となる本を、一緒にお探しします。
                </p>
                <button id="restart-button" onClick={handleGoHome} className="btn-primary w-full max-w-xs mx-auto">
                  別のnoteで本を探す
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ═══ MODALS ═══ */}
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
            <button onClick={() => setShowSignupModal(false)} className="text-xs" style={{ color: 'var(--color-text-dim)' }}>あとで</button>
          </div>
        </div>
      )}

      {/* Home Warning Modal */}
      {showHomeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(44,37,32,0.4)', backdropFilter: 'blur(8px)' }}>
          <div className="card p-8 max-w-sm w-full text-center fade-in-up">
            <div className="text-4xl mb-4">🧭</div>
            <p className="text-sm leading-loose mb-2 font-bold" style={{ color: 'var(--color-text)' }}>
              ホームに戻りますか？
            </p>
            <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
              今回のおすすめが失われます。<br />本棚に登録すれば、いつでも読み返せます。
            </p>
            <Link href="/library" className="btn-primary block w-full mb-3 text-center py-3">
              本棚に登録してから戻る
            </Link>
            <button onClick={doReset} className="text-xs block w-full py-2" style={{ color: 'var(--color-text-dim)' }}>
              登録せずに戻る
            </button>
            <button onClick={() => setShowHomeWarning(false)} className="text-xs mt-1" style={{ color: 'var(--color-text-dim)', opacity: 0.6 }}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Card Carousel — horizontal swipe within a 3-book batch
   ═══════════════════════════════════════════════ */

function CardCarousel({
  books, currentCard, setCurrentCard,
  expandedLetter, setExpandedLetter,
  bookmarkedTitles, handleBookmark,
}: {
  books: BookResult[];
  currentCard: number;
  setCurrentCard: (n: number) => void;
  expandedLetter: number | null;
  setExpandedLetter: (n: number | null) => void;
  bookmarkedTitles: Set<string>;
  handleBookmark: (book: BookResult) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [containerWidth, setContainerWidth] = useState(400);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.offsetWidth);
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setIsSwiping(true);
    setTouchDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.touches[0].clientX - touchStartX;
    setTouchDelta(delta);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null) return;
    if (touchDelta < -60 && currentCard < books.length - 1) {
      track('card_swipe', { fromIndex: currentCard, toIndex: currentCard + 1 });
      setCurrentCard(currentCard + 1);
      setExpandedLetter(null);
    } else if (touchDelta > 60 && currentCard > 0) {
      track('card_swipe', { fromIndex: currentCard, toIndex: currentCard - 1 });
      setCurrentCard(currentCard - 1);
      setExpandedLetter(null);
    }
    setTouchStartX(null);
    setTouchDelta(0);
    setIsSwiping(false);
  };

  // Calculate transform — uses state-based width, not ref
  const baseOffset = -currentCard * 100;
  const swipeOffset = isSwiping ? (touchDelta / containerWidth) * 100 : 0;

  return (
    <div className="carousel-container" ref={containerRef}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      <div className="carousel-track" style={{
        transform: `translateX(${baseOffset + swipeOffset}%)`,
        transition: isSwiping ? 'none' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        {books.map((book, i) => (
          <div key={i} className="carousel-slide">
            <BookCard
              book={book}
              isLetterExpanded={expandedLetter === i}
              onToggleLetter={() => setExpandedLetter(expandedLetter === i ? null : i)}
              isBookmarked={bookmarkedTitles.has(book.title)}
              onBookmark={() => handleBookmark(book)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Book Card Component
   ═══════════════════════════════════════════════ */

function BookCard({ book, isLetterExpanded, onToggleLetter, isBookmarked, onBookmark }: {
  book: BookResult;
  isLetterExpanded: boolean;
  onToggleLetter: () => void;
  isBookmarked: boolean;
  onBookmark: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const hasThumbnail = book.thumbnail && book.thumbnail !== '';

  return (
    <article className="book-card">
      <div className="book-cover-wrapper">
        <div className="book-cover-shadow" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={(hasThumbnail && !imgError) ? book.thumbnail : "/default-cover.png"} 
          alt={`${book.title} 表紙`} 
          className="book-cover-img"
          onError={() => setImgError(true)} 
          loading="lazy" 
          referrerPolicy="no-referrer" 
        />
      </div>

      <p className="book-eyecatch">{book.label}</p>
      <h3 className="book-title">{book.title}</h3>
      <p className="book-author">{book.author}</p>

      {/* Bookmark */}
      <button onClick={onBookmark} className="book-expand-btn mb-2"
        style={isBookmarked ? { color: 'var(--g-coral)', borderColor: 'rgba(232,101,90,0.3)' } : {}}>
        {isBookmarked ? '✅ しおりをはさみました' : '🔖 しおりをはさむ'}
      </button>

      {/* "この本について" — always visible */}
      <div className="book-detail-section mt-3">
        <h4 className="book-detail-label">この本について</h4>
        <p className="book-detail-text">{book.summary}</p>
      </div>

      {/* Letter toggle */}
      <button onClick={() => { track('letter_open', { bookTitle: book.title }); onToggleLetter(); }} className="book-expand-btn mt-3">
        {isLetterExpanded ? '閉じる' : 'お手紙を読む'}
        <span className="expand-arrow" style={{ transform: isLetterExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      {isLetterExpanded && (
        <div className="book-details fade-in-up">
          <div className="book-detail-section book-letter">
            <h4 className="book-detail-label">📝 あなたへの手紙</h4>
            <p className="book-letter-text">{book.letter}</p>
          </div>
        </div>
      )}

      <a href={book.amazonUrl} target="_blank" rel="noopener noreferrer" className="book-amazon-link"
        onClick={() => track('amazon_click', { bookTitle: book.title })}>
        Amazonで見る →
      </a>
    </article>
  );
}
