'use client';

import { useRouter } from 'next/navigation';

export default function GlobalError() {
  const router = useRouter();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 gradient-warm">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="text-5xl font-black text-gradient">Error</div>
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--color-text)' }}>
          エラーが発生しました
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          一時的な問題が発生しました。しばらくしてからもう一度お試しください。
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
