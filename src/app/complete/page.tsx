'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CompletePage() {
  const router = useRouter();
  const [streak, setStreak] = useState(1);
  const [title, setTitle] = useState('');

  useEffect(() => {
    const s = parseInt(localStorage.getItem('day1_streak') || '1', 10);
    setStreak(s);
    const t = localStorage.getItem('day1_last_title') || '';
    setTitle(t);
  }, []);

  const handleShare = () => {
    const memoRaw = localStorage.getItem('day1_last_memo');
    const memos = memoRaw ? JSON.parse(memoRaw) : {};

    let text = `#day1 で今日の学びを自分のものにしました ☀️\n\n`;
    if (title) text += `📖 ${title}\n\n`;
    if (memos.action) text += `💡 ${memos.action.slice(0, 60)}${memos.action.length > 60 ? '...' : ''}\n\n`;
    text += `🔥 ${streak}日連続達成！\n`;

    const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank');
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: 'var(--color-cream)' }}>
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Sunrise emoji */}
        <div className="text-7xl animate-bounce" style={{ animationDuration: '2s' }}>
          ☀️
        </div>

        <header className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold" style={{ color: 'var(--color-text)' }}>
            今日の学び、完了！
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>
            すてきな朝のスタートですね ✨
          </p>
        </header>

        {/* Streak */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--color-text-light)' }}>
            連続達成
          </span>
          <span className="text-4xl font-black tabular-nums" style={{ color: 'var(--color-text)' }}>
            {streak} <span className="text-xl font-medium" style={{ color: 'var(--color-text-light)' }}>日</span>
          </span>
        </div>

        {/* Share Button — X logo */}
        <button
          onClick={handleShare}
          className="w-full py-4 px-6 rounded-xl font-bold text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-3 shadow-md"
          style={{ background: '#000000' }}
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          Xでシェアする
        </button>

        {/* Navigation */}
        <div className="flex gap-3 w-full">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'var(--color-cream-dark)', color: 'var(--color-text)' }}
          >
            TOPに戻る
          </button>
          <button
            onClick={() => router.push('/history')}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'var(--color-cream-dark)', color: 'var(--color-text)' }}
          >
            学習履歴
          </button>
        </div>

      </div>
    </main>
  );
}
