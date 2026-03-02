'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: 'var(--color-cream)' }}>
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">🌅</div>
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-text)' }}>
          ページが見つかりません
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] shadow-md"
          style={{ background: 'var(--color-accent)' }}
        >
          ダッシュボードへ戻る ☀️
        </button>
      </div>
    </main>
  );
}
