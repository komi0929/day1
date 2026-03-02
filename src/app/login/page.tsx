'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password);

      if (result.error) {
        // メアド列挙防止: Supabaseエラーを一般化
        if (isSignUp) {
          // 登録成功でも失敗でも同じメッセージ
          setError('確認メールを送信しました。メールを確認してください。');
        } else {
          setError('メールアドレスまたはパスワードが正しくありません。');
        }
      } else if (isSignUp) {
        setError(null);
        setError('確認メールを送信しました。メールを確認してください。');
      }
    } catch {
      setError('ログインに失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: 'var(--color-cream)' }}>
      <div className="w-full max-w-sm flex flex-col gap-8">

        {/* Logo */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--color-text)' }}>
            day1
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-light)' }}>
            今日の朝を、学びではじめよう ☀️
          </p>
        </header>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-sm"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Googleで続ける
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }}></div>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>または</span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }}></div>
        </div>

        {/* Email Login */}
        <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-xs font-semibold" style={{ color: 'var(--color-text-light)' }}>
              メールアドレス
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-xs font-semibold" style={{ color: 'var(--color-text-light)' }}>
              パスワード
            </label>
            <input
              id="login-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {error && (
            <div className="p-3 text-xs rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50 shadow-md"
            style={{ background: 'var(--color-accent)' }}
          >
            {submitting ? '処理中...' : isSignUp ? '新規登録' : 'ログイン'}
          </button>
        </form>

        <p className="text-center text-xs" style={{ color: 'var(--color-text-light)' }}>
          {isSignUp ? 'すでにアカウントをお持ちですか？' : 'はじめての方はこちら'}
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="ml-1 font-semibold underline"
            style={{ color: 'var(--color-accent-dark)' }}
          >
            {isSignUp ? 'ログイン' : '新規登録'}
          </button>
        </p>

      </div>
    </main>
  );
}
