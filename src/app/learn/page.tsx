'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface Idea {
  id: string;
  text: string;
}

interface LearnData {
  bookmarkId: string;
  url: string;
  title: string;
  articleType: 'DO' | 'BE';
  ideas: Idea[] | null;
  question: string | null;
  articleTitle: string;
}

const EMOTION_TAGS = [
  { emoji: '❤️‍🔥', label: '心が温かくなった' },
  { emoji: '⚡', label: 'ハッとした' },
  { emoji: '🤔', label: '考え込んだ' },
  { emoji: '🥲', label: '涙が出た' },
  { emoji: '💪', label: '勇気をもらった' },
  { emoji: '🌫️', label: 'モヤモヤした' },
];

export default function LearnPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [data, setData] = useState<LearnData | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isCompleting, setIsCompleting] = useState(false);
  const bgRef = useRef<HTMLDivElement>(null);

  // DO state
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [editedCommitment, setEditedCommitment] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // BE state
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [reflection, setReflection] = useState('');

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Load learning data from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('day1_current_learn');
    if (!saved) {
      router.replace('/dashboard');
      return;
    }
    setData(JSON.parse(saved));
  }, [router]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || isCompleting) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isCompleting]);

  // Background gradient calculation
  const getBackgroundColor = useCallback((t: number) => {
    const progress = Math.min(1, Math.max(0, (300 - t) / 300));
    const r = Math.round(74 + (255 - 74) * progress);
    const g = Math.round(74 + (248 - 74) * progress);
    const b = Math.round(82 + (240 - 82) * progress);
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  const getTextColor = useCallback((t: number) => {
    const progress = (300 - t) / 300;
    return progress > 0.5 ? 'var(--color-text)' : '#F5F0EB';
  }, []);

  const getSubTextColor = useCallback((t: number) => {
    const progress = (300 - t) / 300;
    return progress > 0.5 ? 'var(--color-text-light)' : '#C5BFB8';
  }, []);

  const getCardBg = useCallback((t: number) => {
    const progress = (300 - t) / 300;
    return progress > 0.5 ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.3)';
  }, []);

  const getCardBorder = useCallback((t: number) => {
    const progress = (300 - t) / 300;
    return progress > 0.5 ? '1px solid var(--color-border)' : '1px solid rgba(255,255,255,0.15)';
  }, []);

  // Select an idea (DO)
  const handleSelectIdea = (idea: Idea) => {
    setSelectedIdea(idea.id);
    setEditedCommitment(idea.text);
    setIsEditing(false);
  };

  // Toggle emotion tag (BE)
  const toggleEmotion = (emoji: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(emoji) ? prev.filter((e) => e !== emoji) : [...prev, emoji]
    );
  };

  // Can complete?
  const canComplete = data?.articleType === 'DO'
    ? selectedIdea !== null && editedCommitment.trim().length > 0
    : selectedEmotions.length > 0 || reflection.trim().length > 0;

  // Handle completion — save to Supabase
  const handleComplete = async () => {
    if (!data || !supabase || !user || !canComplete) return;
    setIsCompleting(true);

    // Apply fast-forward CSS transition
    if (bgRef.current) {
      bgRef.current.style.transition = 'background-color 1.5s ease-in-out';
      bgRef.current.style.backgroundColor = '#FFF8F0';
    }

    // 1. Mark bookmark as done
    await supabase
      .from('bookmarks')
      .update({ status: 'done', ai_processing_status: 'completed' })
      .eq('id', data.bookmarkId)
      .eq('user_id', user.id);

    // 2. Save learning session
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
        // Keep legacy fields empty
        memo_action: '',
        memo_question: '',
        memo_learning: '',
      });

    // 3. Update streak in profile
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

    // Refresh profile so dashboard shows updated streak
    await refreshProfile();

    // Store completion info
    sessionStorage.setItem('day1_complete_data', JSON.stringify({
      streak: newStreak,
      title: data.articleTitle || data.title,
      articleType: data.articleType,
      commitment: data.articleType === 'DO' ? editedCommitment : '',
      emotions: data.articleType === 'BE' ? selectedEmotions : [],
      reflection: data.articleType === 'BE' ? reflection : '',
    }));

    sessionStorage.removeItem('day1_current_learn');

    setTimeout(() => {
      router.push('/complete');
    }, 1700);
  };

  if (!data || authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
        <p style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </div>
    );
  }

  const bgColor = isCompleting ? undefined : getBackgroundColor(timeLeft);
  const textColor = isCompleting ? 'var(--color-text)' : getTextColor(timeLeft);
  const subColor = isCompleting ? 'var(--color-text-light)' : getSubTextColor(timeLeft);
  const cardBg = isCompleting ? 'rgba(255,255,255,0.85)' : getCardBg(timeLeft);
  const cardBorder = isCompleting ? '1px solid var(--color-border)' : getCardBorder(timeLeft);

  return (
    <div
      ref={bgRef}
      className="min-h-dvh flex flex-col"
      style={{ backgroundColor: bgColor, transition: 'background-color 1s linear' }}
    >
      {/* Completing overlay */}
      {isCompleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ pointerEvents: 'all' }}>
          <div className="text-center" style={{ color: 'var(--color-text)' }}>
            <p className="text-lg font-bold animate-pulse">☀️ おつかれさまでした！</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: subColor }}>
            day1
          </h2>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: data.articleType === 'DO' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
              color: data.articleType === 'DO' ? '#3B82F6' : '#A855F7',
            }}
          >
            {data.articleType === 'DO' ? '🔧 DO' : '🌿 BE'}
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md"
          style={{ background: cardBg, border: cardBorder }}
        >
          <span className="text-xs" style={{ color: subColor }}>⏱</span>
          <span className="font-medium text-sm tabular-nums" style={{ color: textColor }}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </header>

      {/* Article Title */}
      <div className="px-5 pb-4">
        <p className="text-xs line-clamp-1" style={{ color: subColor }}>
          📖 {data.articleTitle || data.title}
        </p>
      </div>

      {/* Content */}
      <main className="flex-1 px-5 pb-5 flex flex-col" style={{ opacity: isCompleting ? 0.3 : 1, transition: 'opacity 0.5s' }}>

        {/* ===== DO: Action Ideas ===== */}
        {data.articleType === 'DO' && data.ideas && (
          <section className="flex-1 flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: subColor }}>
              あなたの課題に合わせた3つのアイデア
            </h3>

            <div className="flex-1 flex flex-col gap-3">
              {data.ideas.map((idea) => {
                const isSelected = selectedIdea === idea.id;
                return (
                  <button
                    key={idea.id}
                    onClick={() => handleSelectIdea(idea)}
                    className="w-full text-left p-4 rounded-xl backdrop-blur-md transition-all active:scale-[0.98]"
                    style={{
                      background: isSelected ? 'var(--color-accent)' : cardBg,
                      border: isSelected ? '2px solid var(--color-accent-dark)' : cardBorder,
                      color: isSelected ? '#fff' : textColor,
                      boxShadow: isSelected ? '0 4px 12px rgba(232, 168, 124, 0.3)' : 'none',
                    }}
                  >
                    <div className="flex gap-3 items-start">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                        style={{
                          background: isSelected ? 'rgba(255,255,255,0.3)' : 'var(--color-accent)',
                          color: '#fff',
                        }}
                      >
                        {isSelected ? '✓' : '💡'}
                      </span>
                      <p className="text-sm leading-relaxed">{idea.text}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Edit commitment area */}
            {selectedIdea && (
              <div className="rounded-xl p-4 backdrop-blur-md" style={{ background: cardBg, border: cardBorder }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold" style={{ color: subColor }}>
                    今日のアクション
                  </span>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ color: 'var(--color-accent-dark)' }}
                  >
                    {isEditing ? '完了' : '✏️ 自分の言葉に編集'}
                  </button>
                </div>
                {isEditing ? (
                  <textarea
                    value={editedCommitment}
                    onChange={(e) => setEditedCommitment(e.target.value)}
                    className="w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed"
                    style={{ color: textColor }}
                    rows={3}
                    placeholder="あなたの言葉でアクションを書き換えてください..."
                  />
                ) : (
                  <p className="text-sm leading-relaxed" style={{ color: textColor }}>
                    💡 {editedCommitment}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleComplete}
              disabled={!canComplete || isCompleting}
              className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-40 shadow-md"
              style={{ background: 'var(--color-accent)' }}
            >
              ☀️ このアクションにコミットする
            </button>
          </section>
        )}

        {/* ===== BE: Question & Emotion Tags ===== */}
        {data.articleType === 'BE' && (
          <section className="flex-1 flex flex-col gap-5">
            {/* The Question */}
            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-4">
              <div
                className="p-6 rounded-2xl backdrop-blur-md text-center"
                style={{ background: cardBg, border: cardBorder }}
              >
                <p className="text-base leading-relaxed font-medium" style={{ color: textColor }}>
                  {data.question}
                </p>
              </div>
            </div>

            {/* Reflection textarea */}
            <div className="rounded-xl p-4 backdrop-blur-md" style={{ background: cardBg, border: cardBorder }}>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="思い浮かんだことを自由に..."
                className="w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed"
                style={{ color: textColor }}
                rows={3}
              />
            </div>

            {/* Emotion Tags */}
            <div>
              <p className="text-xs font-semibold mb-3 text-center" style={{ color: subColor }}>
                この記事を通じて感じたこと
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {EMOTION_TAGS.map((tag) => {
                  const isActive = selectedEmotions.includes(tag.emoji);
                  return (
                    <button
                      key={tag.emoji}
                      onClick={() => toggleEmotion(tag.emoji)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all active:scale-95"
                      style={{
                        background: isActive ? 'var(--color-accent)' : cardBg,
                        border: isActive ? '2px solid var(--color-accent-dark)' : cardBorder,
                        color: isActive ? '#fff' : textColor,
                      }}
                    >
                      <span className="text-base">{tag.emoji}</span>
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleComplete}
              disabled={!canComplete || isCompleting}
              className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-40 shadow-md"
              style={{ background: 'var(--color-accent)' }}
            >
              ☀️ この学びを刻む
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
