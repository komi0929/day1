'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--color-text)' }}>day1</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </div>
    </main>
  );
}
