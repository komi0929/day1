'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else {
      router.replace('/workspace');
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-dvh flex items-center justify-center gradient-main">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-3xl font-black text-gradient">Compass</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </div>
    </main>
  );
}
