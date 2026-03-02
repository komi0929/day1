'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface LearnData {
  bookmarkId: string;
  url: string;
  title: string;
  summary: string;
  points: string[];
}

export default function LearnPage() {
  const router = useRouter();
  const [data, setData] = useState<LearnData | null>(null);
  const [step, setStep] = useState(0); // 0=summary, 1=points, 2=memo
  const [timeLeft, setTimeLeft] = useState(300);
  const [activeTab, setActiveTab] = useState<'action' | 'question' | 'learning'>('action');
  const [memos, setMemos] = useState({ action: '', question: '', learning: '' });
  const [isCompleting, setIsCompleting] = useState(false);
  const bgRef = useRef<HTMLDivElement>(null);

  // Load learning data
  useEffect(() => {
    const saved = localStorage.getItem('day1_current_learn');
    if (!saved) {
      router.replace('/dashboard');
      return;
    }
    setData(JSON.parse(saved));
  }, [router]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || isCompleting) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isCompleting]);

  // Background gradient calculation
  const getBackgroundColor = useCallback((t: number) => {
    // t goes from 300 → 0, progress goes from 0 → 1
    const progress = Math.min(1, Math.max(0, (300 - t) / 300));
    // Dawn start: #4a4a52 (74,74,82) → Dawn end: #FFF8F0 (255,248,240)
    const r = Math.round(74 + (255 - 74) * progress);
    const g = Math.round(74 + (248 - 74) * progress);
    const b = Math.round(82 + (240 - 82) * progress);
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  // Text color: light when dark bg, dark when light bg
  const getTextColor = useCallback((t: number) => {
    const progress = (300 - t) / 300;
    return progress > 0.5 ? 'var(--color-text)' : '#F5F0EB';
  }, []);

  const getSubTextColor = useCallback((t: number) => {
    const progress = (300 - t) / 300;
    return progress > 0.5 ? 'var(--color-text-light)' : '#C5BFB8';
  }, []);

  const getCardBg = useCallback((t: number) => {
    const progress = (300 - t) / 300;
    return progress > 0.5 ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.3)';
  }, []);

  const getCardBorder = useCallback((t: number) => {
    const progress = (300 - t) / 300;
    return progress > 0.5 ? '1px solid var(--color-border)' : '1px solid rgba(255,255,255,0.15)';
  }, []);

  // Handle completion with fast-forward animation
  const handleComplete = () => {
    setIsCompleting(true);

    // Apply fast-forward CSS transition
    if (bgRef.current) {
      bgRef.current.style.transition = 'background-color 1.5s ease-in-out';
      bgRef.current.style.backgroundColor = '#FFF8F0';
    }

    // Save completion data
    const bookmarksRaw = localStorage.getItem('day1_bookmarks');
    if (bookmarksRaw && data) {
      const bookmarks = JSON.parse(bookmarksRaw);
      const updated = bookmarks.map((b: { id: string; status: string }) =>
        b.id === data.bookmarkId ? { ...b, status: 'done' } : b
      );
      localStorage.setItem('day1_bookmarks', JSON.stringify(updated));
    }

    // Streak logic
    const today = new Date().toDateString();
    const lastComplete = localStorage.getItem('day1_last_complete');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let streak = parseInt(localStorage.getItem('day1_streak') || '0', 10);

    if (lastComplete === yesterday.toDateString()) {
      streak += 1;
    } else if (lastComplete !== today) {
      streak = 1;
    }

    localStorage.setItem('day1_streak', streak.toString());
    localStorage.setItem('day1_last_complete', today);

    // Store memo for share page
    localStorage.setItem('day1_last_memo', JSON.stringify(memos));
    localStorage.setItem('day1_last_title', data?.title || '');

    // Wait for animation then navigate
    setTimeout(() => {
      router.push('/complete');
    }, 1700);
  };

  if (!data) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
        <p style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </div>
    );
  }

  const bgColor = isCompleting ? undefined : getBackgroundColor(timeLeft);
  const textColor = isCompleting ? 'var(--color-text)' : getTextColor(timeLeft);
  const subColor = isCompleting ? 'var(--color-text-light)' : getSubTextColor(timeLeft);
  const cardBg = isCompleting ? 'rgba(255,255,255,0.85)' : getCardBg(timeLeft);
  const cardBorder = isCompleting ? '1px solid var(--color-border)' : getCardBorder(timeLeft);

  return (
    <div
      ref={bgRef}
      className="min-h-dvh flex flex-col"
      style={{ backgroundColor: bgColor, transition: 'background-color 1s linear' }}
    >
      {/* Completing overlay */}
      {isCompleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ pointerEvents: 'all' }}>
          <div className="text-center" style={{ color: 'var(--color-text)' }}>
            <p className="text-lg font-bold animate-pulse">☀️ おつかれさまでした！</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex justify-between items-center">
        <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: subColor }}>
          day1
        </h2>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md"
          style={{ background: cardBg, border: cardBorder }}
        >
          <span className="text-xs" style={{ color: subColor }}>⏱</span>
          <span className="font-medium text-sm tabular-nums" style={{ color: textColor }}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="px-5 pb-4 flex gap-2">
        {[0, 1, 2].map((s) => (
          <div
            key={s}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              background: step >= s ? 'var(--color-accent)' : (cardBg),
            }}
          />
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 px-5 pb-5 flex flex-col" style={{ opacity: isCompleting ? 0.3 : 1, transition: 'opacity 0.5s' }}>
        {step === 0 && (
          <section className="flex-1 flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: subColor }}>
              Step 1 — 概要をつかむ
            </h3>
            <div className="flex-1 p-5 rounded-2xl backdrop-blur-md" style={{ background: cardBg, border: cardBorder }}>
              <p className="text-sm leading-relaxed" style={{ color: textColor }}>
                {data.summary}
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
              style={{ background: 'var(--color-accent)' }}
            >
              次へ：キーポイントを読む →
            </button>
          </section>
        )}

        {step === 1 && (
          <section className="flex-1 flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: subColor }}>
              Step 2 — 3つのポイント
            </h3>
            <div className="flex-1 flex flex-col gap-3">
              {data.points.map((pt, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl backdrop-blur-md"
                  style={{ background: cardBg, border: cardBorder }}
                >
                  <div className="flex gap-3 items-start">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'var(--color-accent)', color: '#fff' }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: textColor }}>{pt}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(0)}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
                style={{ background: cardBg, border: cardBorder, color: textColor }}
              >
                ← 戻る
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                style={{ background: 'var(--color-accent)' }}
              >
                次へ →
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="flex-1 flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: subColor }}>
              Step 3 — あなたの考えを書こう
            </h3>

            {/* Memo Tabs */}
            <div className="flex gap-1 rounded-xl p-1" style={{ background: cardBg }}>
              {(['action', 'question', 'learning'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 text-xs font-medium rounded-lg transition-all"
                  style={{
                    background: activeTab === tab ? 'var(--color-accent)' : 'transparent',
                    color: activeTab === tab ? '#fff' : subColor,
                  }}
                >
                  {tab === 'action' ? 'アクション' : tab === 'question' ? '疑問' : '学び'}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div className="flex-1 rounded-xl p-4 backdrop-blur-md" style={{ background: cardBg, border: cardBorder }}>
              <textarea
                value={memos[activeTab]}
                onChange={(e) => setMemos({ ...memos, [activeTab]: e.target.value })}
                placeholder={
                  activeTab === 'action' ? 'この記事を読んで、明日からやってみたいことは？' :
                  activeTab === 'question' ? '読んでいて浮かんだ疑問やモヤモヤは？' :
                  'さらに深掘りしたいテーマやキーワードは？'
                }
                className="w-full h-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed"
                style={{ color: textColor }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
                style={{ background: cardBg, border: cardBorder, color: textColor }}
              >
                ← 戻る
              </button>
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'var(--color-accent)' }}
              >
                ☀️ 学びを完了する
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
