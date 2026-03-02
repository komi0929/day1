'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Suspense } from 'react';

function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'receiving' | 'saved' | 'error'>('receiving');
  const [sharedUrl, setSharedUrl] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (authLoading || !user || !supabase) return;

    const processShare = async () => {
      // Extract URL from share params
      const urlParam = searchParams.get('url') || '';
      const textParam = searchParams.get('text') || '';
      const titleParam = searchParams.get('title') || '';

      // Try to find a note.com URL from the params
      let noteUrl = '';
      if (urlParam && urlParam.includes('note.com')) {
        noteUrl = urlParam;
      } else if (textParam) {
        // Sometimes the URL is in the text param
        const urlMatch = textParam.match(/https?:\/\/note\.com\/[^\s]+/);
        if (urlMatch) noteUrl = urlMatch[0];
      }

      if (!noteUrl) {
        setStatus('error');
        return;
      }

      setSharedUrl(noteUrl);

      try {
        // Fetch OGP metadata
        let title = titleParam || noteUrl.split('/').pop()?.replace(/-/g, ' ') || 'Untitled';
        let imageUrl: string | null = null;

        try {
          const ogpRes = await fetch('/api/ogp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: noteUrl }),
          });
          const ogpData = await ogpRes.json();
          if (ogpData.title) title = ogpData.title;
          if (ogpData.image) imageUrl = ogpData.image;
        } catch {
          // OGP failed, use fallback
        }

        // Save to bookmarks
        if (!supabase) {
          setStatus('error');
          return;
        }
        const { error: insertError } = await supabase
          .from('bookmarks')
          .insert({
            user_id: user.id,
            url: noteUrl,
            title,
            image_url: imageUrl,
            status: 'unread',
            ai_processing_status: 'pending',
            shared_at: new Date().toISOString(),
          });

        if (insertError) {
          setStatus('error');
          return;
        }

        setStatus('saved');
      } catch {
        setStatus('error');
      }
    };

    processShare();
  }, [user, authLoading, searchParams, router]);

  if (authLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: 'var(--color-cream)' }}>
      <div className="w-full max-w-sm flex flex-col items-center gap-6">

        {status === 'receiving' && (
          <>
            <div className="text-5xl animate-pulse">📥</div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              記事を受け取っています...
            </p>
          </>
        )}

        {status === 'saved' && (
          <>
            <div className="text-5xl">✅</div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                保存しました！
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-light)' }}>
                {sharedUrl && <span className="block truncate">{sharedUrl}</span>}
                ダッシュボードから学習を開始できます。
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] shadow-md"
              style={{ background: 'var(--color-accent)' }}
            >
              ダッシュボードへ ☀️
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl">😅</div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                保存できませんでした
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-light)' }}>
                note.comの記事URLのみ対応しています。
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
              style={{ background: 'var(--color-cream-dark)', color: 'var(--color-text)' }}
            >
              ダッシュボードへ戻る
            </button>
          </>
        )}

      </div>
    </main>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </main>
    }>
      <ShareContent />
    </Suspense>
  );
}
