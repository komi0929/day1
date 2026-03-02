'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  const [completeData, setCompleteData] = useState<CompleteData | null>(null);

  useEffect(() => {
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
  }, []);

  const handleShare = () => {
    if (!completeData) return;
    const text = completeData.articleType === 'DO'
      ? `day1で学んで、明日やること決めた。\n\n「${completeData.commitment}」\n\n#day1 #朝活`
      : `day1で記事を読んで、内省した。\n\n${completeData.emotions.join(' / ')}\n\n#day1 #朝活`;

    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(xUrl, '_blank');
  };

  if (!completeData) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 gradient-sunset">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 text-center">

        <div className="space-y-3">
          <h1 className="text-3xl font-black text-gradient">
            血肉化、完了。
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            新しい day1 がはじまりました
          </p>
        </div>

        {/* Article info */}
        <div className="card p-4 w-full text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className={`badge ${completeData.articleType === 'DO' ? 'badge-do' : 'badge-be'}`}>
              {completeData.articleType}
            </span>
          </div>
          <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--color-text)' }}>
            {completeData.title}
          </p>
        </div>

        {/* DO: commitment */}
        {completeData.articleType === 'DO' && completeData.commitment && (
          <div className="card p-4 w-full text-left">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-dim)' }}>
              明日のアクション
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
              {completeData.commitment}
            </p>
          </div>
        )}

        {/* BE: emotions */}
        {completeData.articleType === 'BE' && completeData.emotions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {completeData.emotions.map((tag, i) => (
              <span key={i} className="badge badge-be">{tag}</span>
            ))}
          </div>
        )}

        {/* Streak */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--color-text-dim)' }}>
            連続達成
          </span>
          <span className="text-4xl font-black tabular-nums text-gradient">
            {completeData.streak} <span className="text-xl font-medium" style={{ color: 'var(--color-text-muted)' }}>日</span>
          </span>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          aria-label="Xでシェアする"
          className="w-full py-4 px-6 rounded-xl font-bold text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-3"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
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
            className="btn-ghost flex-1"
          >
            ダッシュボード
          </button>
          <button
            onClick={() => router.push('/history')}
            className="btn-ghost flex-1"
          >
            履歴
          </button>
        </div>

      </div>
    </main>
  );
}
