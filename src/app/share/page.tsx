'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

function ShareContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const sharedUrl = searchParams.get('url') || searchParams.get('text') || '';

    const noteUrlMatch = sharedUrl.match(/https?:\/\/note\.com\/[^\s]+/);
    if (!noteUrlMatch) {
      setStatus('error');
      return;
    }

    const processShare = async () => {
      if (!supabase) {
        setStatus('error');
        return;
      }

      try {
        let title = noteUrlMatch[0].split('/').pop()?.replace(/-/g, ' ') || 'Untitled';
        let imageUrl: string | null = null;

        try {
          const ogpRes = await fetch('/api/ogp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: noteUrlMatch[0] }),
          });
          const ogpData = await ogpRes.json();
          if (ogpData.title) title = ogpData.title;
          if (ogpData.image) imageUrl = ogpData.image;
        } catch {
          // OGP fetch failed
        }

        if (!supabase) {
          setStatus('error');
          return;
        }
        const { error: insertError } = await supabase
          .from('bookmarks')
          .insert({
            user_id: user.id,
            url: noteUrlMatch[0],
            title,
            image_url: imageUrl,
            status: 'unread',
            ai_processing_status: 'pending',
          });

        if (insertError) {
          setStatus('error');
          return;
        }

        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 2000);
      } catch {
        setStatus('error');
      }
    };

    processShare();
  }, [user, authLoading, searchParams, router]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 gradient-warm">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        {status === 'processing' && (
          <>
            <div className="text-3xl font-black text-gradient">保存中</div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              記事を保存しています...
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-3xl font-black text-gradient">保存完了</div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              ダッシュボードに追加しました
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-3xl font-black" style={{ color: 'var(--g-coral)' }}>エラー</div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              記事の保存に失敗しました
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary"
            >
              ダッシュボードへ
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
      <main className="min-h-dvh flex items-center justify-center gradient-warm">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    }>
      <ShareContent />
    </Suspense>
  );
}
