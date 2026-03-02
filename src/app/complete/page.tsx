'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface CompleteData {
  streak: number;
  title: string;
  articleType: 'DO' | 'BE';
  commitment: string;
  emotions: string[];
  reflection: string;
}

export default function CompletePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [completeData, setCompleteData] = useState<CompleteData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }

    const saved = sessionStorage.getItem('day1_complete_data');
    if (saved) {
      setCompleteData(JSON.parse(saved));
    } else {
      setCompleteData({
        streak: 1,
        title: '',
        articleType: 'DO',
        commitment: '',
        emotions: [],
        reflection: '',
      });
    }
  }, [user, authLoading, router]);

  const handleShare = () => {
    if (!completeData) return;

    let text = `#day1 で今日の学びを血肉にしました ☀️\n\n`;
    if (completeData.title) text += `📖 ${completeData.title}\n\n`;

    if (completeData.articleType === 'DO' && completeData.commitment) {
      text += `💡 今日のアクション:\n${completeData.commitment.slice(0, 80)}${completeData.commitment.length > 80 ? '...' : ''}\n\n`;
    } else if (completeData.articleType === 'BE' && completeData.emotions.length > 0) {
      text += `${completeData.emotions.join(' ')} ← この記事で感じたこと\n\n`;
    }

    text += `🔥 ${completeData.streak}日連続達成！\n`;

    const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank');
  };

  if (!completeData || authLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: 'var(--color-cream)' }}>
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Sunrise emoji */}
        <div className="text-7xl animate-bounce" style={{ animationDuration: '2s' }}>
          ☀️
        </div>

        <header className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold" style={{ color: 'var(--color-text)' }}>
            {completeData.articleType === 'DO' ? 'アクション、コミット完了！' : '今日の内省、完了！'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>
            すてきな朝のスタートですね ✨
          </p>
        </header>

        {/* What you committed/felt */}
        {completeData.articleType === 'DO' && completeData.commitment && (
          <div
            className="w-full p-4 rounded-xl text-sm leading-relaxed"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            <span className="text-xs font-bold block mb-1" style={{ color: 'var(--color-text-light)' }}>
              💡 今日のアクション
            </span>
            {completeData.commitment}
          </div>
        )}

        {completeData.articleType === 'BE' && completeData.emotions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {completeData.emotions.map((emoji, i) => (
              <span key={i} className="text-3xl">{emoji}</span>
            ))}
          </div>
        )}

        {/* Streak */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--color-text-light)' }}>
            連続達成
          </span>
          <span className="text-4xl font-black tabular-nums" style={{ color: 'var(--color-text)' }}>
            {completeData.streak} <span className="text-xl font-medium" style={{ color: 'var(--color-text-light)' }}>日</span>
          </span>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          aria-label="Xでシェアする"
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
