'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const loggedIn = localStorage.getItem('day1_logged_in');
    if (loggedIn === 'true') {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--color-text)' }}>day1</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </div>
    </main>
  );
}
