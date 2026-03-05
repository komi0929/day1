'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-dvh flex items-center justify-center gradient-library px-4">
      <div className="text-center">
        <div className="text-6xl mb-6 opacity-30">📖</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-text-muted)' }}>
          ページが見つかりません
        </h2>
        <button onClick={() => router.push('/')} className="btn-library mt-4">
          トップへ戻る
        </button>
      </div>
    </main>
  );
}
