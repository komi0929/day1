'use client';

import { useRouter } from 'next/navigation';

export default function GlobalError() {
  const router = useRouter();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: '#1A1716', color: '#F0EDE8' }}>
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="text-5xl font-black" style={{ background: 'linear-gradient(135deg, #E8655A, #F2A87C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Error</div>
        <h1 className="text-xl font-extrabold" style={{ color: '#F0EDE8' }}>
          エラーが発生しました
        </h1>
        <p className="text-sm" style={{ color: 'rgba(240,237,232,0.55)' }}>
          一時的な問題が発生しました。しばらくしてからもう一度お試しください。
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: 'linear-gradient(135deg, #E8655A, #F2A87C)', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 12, padding: '14px 24px', fontSize: 14, width: '100%', cursor: 'pointer' }}
        >
          ダッシュボードへ戻る
        </button>
      </div>
    </main>
  );
}
