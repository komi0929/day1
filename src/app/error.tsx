'use client';

import { useRouter } from 'next/navigation';

export default function GlobalError() {
  const router = useRouter();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: '#FFF8F0' }}>
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-2xl font-extrabold" style={{ color: '#3D3530' }}>
          エラーが発生しました
        </h1>
        <p className="text-sm" style={{ color: '#7A716A' }}>
          一時的な問題が発生しました。しばらくしてからもう一度お試しください。
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] shadow-md"
          style={{ background: '#E8A87C' }}
        >
          ダッシュボードへ戻る ☀️
        </button>
      </div>
    </main>
  );
}
