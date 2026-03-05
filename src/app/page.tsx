'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

/* ─── Types ─── */
interface BookResult {
  title: string;
  author: string;
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
  const [phase, setPhase] = useState<AppPhase>('input');
  const [noteUrl, setNoteUrl] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Results
  const [allBooks, setAllBooks] = useState<BookResult[]>([]);
  const [fragments, setFragments] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  // Waiting screen animation
  const [currentFragment, setCurrentFragment] = useState(0);
  const [fragmentVisible, setFragmentVisible] = useState(false);

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
        throw new Error(data.message || 'エラーが発生しました');
      }

      const data = await res.json();
      setNoteBody(data.body);
      setNoteTitle(data.title || '');
      startRecommendation(data.body, data.title || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setLoading(false);
    }
  }, [noteUrl, loading]);

  /* ─── Fallback text submit ─── */
  const handleFallbackSubmit = useCallback(() => {
    if (!noteBody.trim() || noteBody.trim().length < 50) {
      setError('もう少し長い本文を入力してください（50文字以上）');
      return;
    }
    startRecommendation(noteBody, noteTitle);
  }, [noteBody, noteTitle]);

  /* ─── Start recommendation process ─── */
  const startRecommendation = async (body: string, title: string) => {
    setPhase('waiting');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, title }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || '推薦の生成に失敗しました');
      }

      const data = await res.json();
      setAllBooks(data.books || []);
      setFragments(data.fragments || []);
      setCurrentPage(0);
      setExpandedCard(null);
      setPhase('results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '推薦の生成に失敗しました');
      setPhase('input');
    } finally {
      setLoading(false);
    }
  };

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
      if (shuffled.length > 0) {
        setFragments(shuffled);
      }
    }
  }, [phase, noteBody, fragments.length]);

  /* ─── Pagination ─── */
  const booksPerPage = 3;
  const totalPages = Math.ceil(allBooks.length / booksPerPage);
  const currentBooks = allBooks.slice(
    currentPage * booksPerPage,
    (currentPage + 1) * booksPerPage
  );
  const isLastPage = currentPage >= totalPages - 1;

  const handleNextPage = () => {
    if (!isLastPage) {
      setCurrentPage(prev => prev + 1);
      setExpandedCard(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleReset = () => {
    setPhase('input');
    setNoteUrl('');
    setNoteBody('');
    setNoteTitle('');
    setShowFallback(false);
    setAllBooks([]);
    setFragments([]);
    setCurrentPage(0);
    setExpandedCard(null);
    setError(null);
    setLoading(false);
    setCurrentFragment(0);
  };

  return (
    <div className="gradient-library min-h-dvh">
      {/* ═══ INPUT PHASE ═══ */}
      {phase === 'input' && (
        <main className="min-h-dvh">
          {/* ─── Hero section ─── */}
          <section className="flex items-center justify-center px-4 pt-20 pb-12 md:pt-28 md:pb-16">
            <div className="max-w-lg w-full text-center">
              <div className="mb-10 fade-in-up">
                <div className="text-5xl mb-5 opacity-70">📖</div>
                <h1 className="text-3xl md:text-4xl font-black text-gradient-library tracking-tight mb-4">
                  あなたのための1冊
                </h1>
                <p className="text-sm leading-[1.9] max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                  noteに綴ったあなたの思考をAIが深く読み解き、<br />
                  今のあなたに寄り添う<strong style={{ color: 'var(--color-accent-bright)' }}>「運命の本」</strong>を見つけます。
                </p>
              </div>

              {/* URL Input */}
              <div className="fade-in-up" style={{ animationDelay: '0.15s' }}>
                <div className="card-library p-4 mb-4">
                  <input
                    id="note-url-input"
                    type="url"
                    className="input-library w-full"
                    placeholder="https://note.com/..."
                    value={noteUrl}
                    onChange={e => setNoteUrl(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && noteUrl.trim()) handleSubmit();
                    }}
                    disabled={loading}
                  />
                </div>
                <button
                  id="submit-button"
                  onClick={handleSubmit}
                  disabled={!noteUrl.trim() || loading}
                  className="btn-library w-full"
                >
                  {loading ? (
                    <span className="analyzing-pulse">解析中...</span>
                  ) : (
                    '本を探す'
                  )}
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 p-3 text-xs rounded-lg text-left" style={{
                  background: 'rgba(232, 101, 90, 0.12)',
                  color: 'var(--g-coral)',
                  border: '1px solid rgba(232, 101, 90, 0.2)',
                }}>
                  {error}
                </div>
              )}

              {/* Fallback */}
              {showFallback && (
                <div className="mt-6 fade-in-up text-left" style={{ animationDelay: '0.1s' }}>
                  <div className="p-3 text-xs rounded-lg mb-4" style={{
                    background: 'rgba(232, 197, 71, 0.12)',
                    color: 'var(--g-amber)',
                    border: '1px solid rgba(232, 197, 71, 0.2)',
                  }}>
                    URLからの取得に失敗しました。本文を直接貼り付けてください。
                  </div>
                  <textarea
                    id="fallback-textarea"
                    className="textarea-library w-full mb-3"
                    placeholder="noteの本文をここに貼り付けてください..."
                    value={noteBody}
                    onChange={e => setNoteBody(e.target.value)}
                    rows={8}
                  />
                  <button
                    id="fallback-submit"
                    onClick={handleFallbackSubmit}
                    disabled={noteBody.trim().length < 50 || loading}
                    className="btn-library w-full"
                  >
                    この内容で本を探す
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ─── How it works ─── */}
          <section className="px-4 pb-16">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-center text-xs font-bold tracking-[3px] uppercase mb-8" style={{ color: 'var(--color-text-dim)' }}>
                使い方
              </h2>
              <div className="how-steps">
                <div className="how-step fade-in-up" style={{ animationDelay: '0.1s' }}>
                  <div className="how-step-num">1</div>
                  <div>
                    <h3 className="how-step-title">noteのURLを貼る</h3>
                    <p className="how-step-desc">あなたが書いたnoteの記事URLを入力してください。悩み、考えごと、日記、どんな記事でも構いません。</p>
                  </div>
                </div>
                <div className="how-step fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="how-step-num">2</div>
                  <div>
                    <h3 className="how-step-title">AIが深く読み解く</h3>
                    <p className="how-step-desc">あなたの文章の行間から、立場・悩み・課題感・隠れた願望をAIが推論します。約30秒の間、あなたの言葉が画面に浮かびます。</p>
                  </div>
                </div>
                <div className="how-step fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <div className="how-step-num">3</div>
                  <div>
                    <h3 className="how-step-title">運命の本に出会う</h3>
                    <p className="how-step-desc">あなたのために選ばれた本が、編集者からの手紙とともに届きます。なぜこの本なのか——その理由は、あなたの言葉の中にあります。</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Footer ─── */}
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
                30秒ほどかかります、ゆっくりお待ちください
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                あなたのnoteを深く読み解いています...
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
          isLastPage={isLastPage}
          expandedCard={expandedCard}
          setExpandedCard={setExpandedCard}
          handleNextPage={handleNextPage}
          handleReset={handleReset}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Results View Component
   ═══════════════════════════════════════════════ */

function ResultsView({
  books, currentPage, totalPages, isLastPage,
  expandedCard, setExpandedCard, handleNextPage, handleReset,
}: {
  books: BookResult[];
  currentPage: number;
  totalPages: number;
  isLastPage: boolean;
  expandedCard: number | null;
  setExpandedCard: (i: number | null) => void;
  handleNextPage: () => void;
  handleReset: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 80 && !isLastPage) handleNextPage();
    setTouchStart(null);
  };

  return (
    <main className="min-h-dvh pb-24">
      <header className="pt-10 pb-6 px-6 text-center">
        <p className="text-[10px] font-bold tracking-[3px] uppercase mb-2" style={{ color: 'var(--color-text-dim)' }}>
          {currentPage + 1} / {totalPages}
        </p>
        <h2 className="text-xl font-bold text-gradient-library">あなたのための本</h2>
      </header>

      <div ref={containerRef} className="result-grid px-4 md:px-8"
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      >
        {books.map((book, i) => (
          <BookCard key={`${currentPage}-${i}`} book={book} index={i}
            isExpanded={expandedCard === i}
            onToggle={() => setExpandedCard(expandedCard === i ? null : i)}
          />
        ))}
      </div>

      <div className="px-6 mt-8 max-w-lg mx-auto">
        {!isLastPage ? (
          <button id="load-more-button" onClick={handleNextPage} className="btn-library-ghost w-full">
            他の本も見てみる →
          </button>
        ) : (
          <div className="text-center fade-in-up">
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
              別のnoteでも、<br />あなたの指標になる本を探してみませんか？
            </p>
            <button id="restart-button" onClick={handleReset} className="btn-library w-full max-w-xs mx-auto">
              もう一度探す
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════
   Book Card Component
   ═══════════════════════════════════════════════ */

function BookCard({ book, index, isExpanded, onToggle }: {
  book: BookResult; index: number; isExpanded: boolean; onToggle: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <article className="book-card fade-in-up" style={{ animationDelay: `${index * 0.12}s` }}>
      <div className="book-cover-wrapper">
        <div className="book-cover-shadow" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgError ? '/default-cover.png' : book.thumbnail} alt={`${book.title} 表紙`}
          className="book-cover-img" onError={() => setImgError(true)} loading="lazy" />
      </div>

      <div className="book-label">{book.label}</div>
      <h3 className="book-title">{book.title}</h3>
      <p className="book-author">{book.author}</p>
      <p className="book-headline">{book.headline}</p>
      <p className="book-oneliner">「{book.oneliner}」</p>

      <button onClick={onToggle} className="book-expand-btn">
        {isExpanded ? '閉じる' : '推薦文を読む'}
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
