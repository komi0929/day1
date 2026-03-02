'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 gradient-cool">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="text-6xl font-black text-gradient">404</div>
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--color-text)' }}>
          ページが見つかりません
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="btn-primary w-full"
        >
          ダッシュボードへ戻る
        </button>
      </div>
    </main>
  );
}
