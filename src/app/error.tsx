'use client';

export default function ErrorPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center gradient-warm px-4">
      <div className="text-center">
        <div className="text-6xl mb-6 opacity-30">⚠️</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-text-muted)' }}>
          ごめんなさい、うまくいきませんでした
        </h2>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-4"
        >
          もう一度試す
        </button>
      </div>
    </main>
  );
}
