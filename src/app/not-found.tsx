'use client';

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gradient-main p-6 text-center">
      <div className="text-6xl mb-6 opacity-30">🧭</div>
      <h1 className="text-2xl font-black mb-2 text-gradient">404</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        ページが見つかりません
      </p>
      <a href="/" className="btn-ghost">トップに戻る</a>
    </main>
  );
}
