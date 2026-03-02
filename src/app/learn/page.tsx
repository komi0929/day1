'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface Idea { id: string; text: string; }

interface LearnData {
  bookmarkId: string;
  url: string;
  title: string;
  articleType: 'DO' | 'BE';
  ideas: Idea[] | null;
  question: string | null;
  articleTitle: string;
}

const EMOTION_TAGS = ['共感', '驚き', '安心', '切なさ', '勇気', '感謝', '葛藤', '希望'];

const BG_COLORS = [
  '#1a1716', '#1d1a1f', '#1a1d1f', '#1f1d1a',
  '#1a1716', '#1d1a1f', '#1a1d1f', '#1a1716',
];

export default function LearnPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [data, setData] = useState<LearnData | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isCompleting, setIsCompleting] = useState(false);

  // DO state
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [editedCommitment, setEditedCommitment] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // BE state
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [reflection, setReflection] = useState('');

  const bgRef = useRef<HTMLElement>(null);

  // Load data from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('day1_current_learn');
    if (!saved) {
      router.replace('/dashboard');
      return;
    }
    setData(JSON.parse(saved));
  }, [router]);

  // Timer + background transition
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (bgRef.current && next > 0) {
          const progress = 1 - next / 300;
          const colorIndex = Math.min(Math.floor(progress * BG_COLORS.length), BG_COLORS.length - 1);
          bgRef.current.style.transition = 'background-color 3s ease';
          bgRef.current.style.backgroundColor = BG_COLORS[colorIndex];
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const handleSelectIdea = (idea: Idea) => {
    setSelectedIdea(idea.id);
    setEditedCommitment(idea.text);
    setIsEditing(false);
  };

  const toggleEmotion = (tag: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(tag) ? prev.filter((e) => e !== tag) : [...prev, tag]
    );
  };

  const canComplete = data?.articleType === 'DO'
    ? selectedIdea !== null && editedCommitment.trim().length > 0
    : selectedEmotions.length > 0 || reflection.trim().length > 0;

  const handleComplete = async () => {
    if (!data || !supabase || !user || !canComplete) return;
    setIsCompleting(true);

    if (bgRef.current) {
      bgRef.current.style.transition = 'background-color 1.5s ease-in-out';
      bgRef.current.style.backgroundColor = '#1A1716';
    }

    await supabase
      .from('bookmarks')
      .update({ status: 'done', ai_processing_status: 'completed' })
      .eq('id', data.bookmarkId)
      .eq('user_id', user.id);

    await supabase
      .from('learning_sessions')
      .insert({
        user_id: user.id,
        bookmark_id: data.bookmarkId,
        article_type: data.articleType,
        ai_generated_ideas: data.ideas || [],
        ai_generated_question: data.question || '',
        ai_summary: data.articleTitle,
        ai_points: [],
        user_commitment: data.articleType === 'DO' ? editedCommitment : '',
        user_emotion_tags: data.articleType === 'BE' ? selectedEmotions : [],
        user_reflection: data.articleType === 'BE' ? reflection : '',
        check_in_status: data.articleType === 'DO' ? 'pending' : 'completed',
        memo_action: '',
        memo_question: '',
        memo_learning: '',
      });

    const today = new Date().toISOString().split('T')[0];
    const { data: profileData } = await supabase
      .from('profiles')
      .select('streak, last_completed_at')
      .eq('id', user.id)
      .single();

    let newStreak = 1;
    if (profileData) {
      const lastDate = profileData.last_completed_at
        ? new Date(profileData.last_completed_at).toISOString().split('T')[0]
        : null;

      if (lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastDate === yesterdayStr) {
          newStreak = (profileData.streak ?? 0) + 1;
        } else if (lastDate === today) {
          newStreak = profileData.streak ?? 1;
        }
      }
    }

    await supabase
      .from('profiles')
      .update({ streak: newStreak, last_completed_at: new Date().toISOString() })
      .eq('id', user.id);

    await refreshProfile();

    sessionStorage.setItem('day1_complete_data', JSON.stringify({
      streak: newStreak,
      title: data.articleTitle || data.title,
      articleType: data.articleType,
      commitment: data.articleType === 'DO' ? editedCommitment : '',
      emotions: data.articleType === 'BE' ? selectedEmotions : [],
      reflection: data.articleType === 'BE' ? reflection : '',
    }));

    sessionStorage.removeItem('day1_current_learn');

    setTimeout(() => router.push('/complete'), 1500);
  };

  if (!data || authLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <main ref={bgRef} className="min-h-dvh flex flex-col" style={{ backgroundColor: '#1a1716', transition: 'background-color 3s ease' }}>
      <div className="flex-1 flex flex-col p-5 max-w-lg mx-auto w-full">

        {/* Timer */}
        <div className="flex justify-between items-center mb-6">
          <span className="badge badge-do">
            {data.articleType}
          </span>
          <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Article Title */}
        <h2 className="text-lg font-bold mb-6 leading-snug" style={{ color: 'var(--color-text)' }}>
          {data.articleTitle || data.title}
        </h2>

        {/* DO Flow */}
        {data.articleType === 'DO' && data.ideas && (
          <div className="flex flex-col gap-4 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-dim)' }}>
              明日やるアクションを選んでください
            </p>
            <div className="flex flex-col gap-3">
              {data.ideas.map((idea) => (
                <button
                  key={idea.id}
                  onClick={() => handleSelectIdea(idea)}
                  className="text-left p-4 rounded-xl transition-all active:scale-[0.98]"
                  style={{
                    background: selectedIdea === idea.id
                      ? 'linear-gradient(135deg, var(--g-coral), var(--g-peach))'
                      : 'var(--color-surface)',
                    border: selectedIdea === idea.id
                      ? '1px solid rgba(232, 168, 124, 0.4)'
                      : '1px solid var(--color-border)',
                    color: selectedIdea === idea.id ? '#fff' : 'var(--color-text)',
                  }}
                >
                  <p className="text-sm leading-relaxed">{idea.text}</p>
                </button>
              ))}
            </div>

            {selectedIdea && (
              <div className="mt-2">
                {isEditing ? (
                  <textarea
                    value={editedCommitment}
                    onChange={(e) => setEditedCommitment(e.target.value)}
                    className="input-field h-24 resize-none"
                    placeholder="自分の言葉で書き換えてもOK"
                  />
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    自分の言葉で書き換える
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* BE Flow */}
        {data.articleType === 'BE' && (
          <div className="flex flex-col gap-6 flex-1">
            {data.question && (
              <div className="card p-5">
                <p className="text-sm leading-relaxed italic" style={{ color: 'var(--color-text)' }}>
                  {data.question}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-dim)' }}>
                今の気持ちに近いものを選んでください
              </p>
              <div className="flex flex-wrap gap-2">
                {EMOTION_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleEmotion(tag)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
                    style={{
                      background: selectedEmotions.includes(tag)
                        ? 'linear-gradient(135deg, var(--g-violet), var(--g-blue))'
                        : 'var(--color-surface)',
                      color: selectedEmotions.includes(tag) ? '#fff' : 'var(--color-text-muted)',
                      border: selectedEmotions.includes(tag)
                        ? '1px solid rgba(139, 107, 181, 0.4)'
                        : '1px solid var(--color-border)',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="思い浮かんだことを自由に書いてみてください..."
              className="input-field h-28 resize-none flex-1"
            />
          </div>
        )}

        {/* Complete Button */}
        <div className="mt-6 pb-4">
          <button
            onClick={handleComplete}
            disabled={!canComplete || isCompleting}
            className="btn-primary w-full disabled:opacity-30"
          >
            {isCompleting ? '血肉化中...' : '血肉にする'}
          </button>
        </div>

      </div>
    </main>
  );
}
