'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/workspace');
    }
  }, [user, loading, router]);

  const handleGoogleLogin = async () => {
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 gradient-sunset">
      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Logo */}
        <header className="text-center space-y-4">
          <div className="text-5xl mb-2">🧭</div>
          <h1 className="text-5xl font-black tracking-tighter text-gradient">
            Compass
          </h1>
          <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            もやもやから、自分だけの指針を見つける
          </p>
        </header>

        {/* Description */}
        <div className="card p-5 text-center">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            他者の言葉と自分のもやもやを掛け合わせ、<br />
            AIが深層心理を言語化。<br />
            あなただけのNow / Be / Doを導き出す<br />
            インサイト・ライブラリ。
          </p>
        </div>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          aria-label="Googleでログイン"
          className="card w-full py-3.5 px-4 font-semibold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          style={{ color: 'var(--color-text)' }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Googleで始める
        </button>

        {error && (
          <div className="p-3 text-xs rounded-lg text-center" style={{ background: 'rgba(232, 101, 90, 0.12)', color: 'var(--g-coral)', border: '1px solid rgba(232, 101, 90, 0.2)' }}>
            {error}
          </div>
        )}

        <div className="flex justify-center gap-4 mt-2 text-xs" style={{ color: 'var(--color-text-dim)' }}>
          <a href="/terms" className="underline hover:opacity-80">利用規約</a>
          <a href="/privacy" className="underline hover:opacity-80">プライバシーポリシー</a>
        </div>
      </div>
    </main>
  );
}
