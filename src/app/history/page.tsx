'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface HistoryItem {
  id: string;
  url: string;
  title: string;
  status: 'unread' | 'done';
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [doneItems, setDoneItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDoneItems(data as HistoryItem[]);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: 'var(--color-cream)' }}>

      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm"
          style={{ color: 'var(--color-accent-dark)' }}
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>学習履歴</h1>
      </header>

      {/* List */}
      <section className="flex-1 px-5 pb-8">
        {doneItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl">🌅</span>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-light)' }}>
              まだ学習履歴がありません。
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {doneItems.map((item) => (
              <li
                key={item.id}
                className="p-4 rounded-xl shadow-sm"
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                      {item.title}
                    </p>
                    <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-light)' }}>
                      {item.url}
                    </p>
                  </div>
                  <span className="text-lg shrink-0 ml-2">☀️</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </main>
  );
}
