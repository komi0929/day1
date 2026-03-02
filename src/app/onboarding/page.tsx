'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const CHALLENGES = [
  { id: 'career', emoji: '💼', label: '仕事 / キャリア', description: '成長・転職・スキルアップ' },
  { id: 'relationships', emoji: '🤝', label: '人間関係', description: 'コミュニケーション・信頼' },
  { id: 'mindset', emoji: '🧠', label: 'マインド / メンタル', description: '思考法・ストレス・自己理解' },
  { id: 'money', emoji: '💰', label: 'お金 / 資産', description: '貯蓄・投資・経済的自由' },
  { id: 'health', emoji: '🏃', label: '健康 / ライフスタイル', description: '習慣・運動・食事・睡眠' },
  { id: 'skills', emoji: '📚', label: 'スキルアップ', description: '学習法・読書・資格' },
  { id: 'creativity', emoji: '🎨', label: '創造性 / 表現', description: '発想力・アウトプット・副業' },
  { id: 'purpose', emoji: '🧭', label: '生き方 / 哲学', description: '価値観・人生の方向性' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, profile, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0); // 0: welcome, 1: select

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Already onboarded? Go to dashboard
  useEffect(() => {
    if (profile && profile.current_challenges && profile.current_challenges.length > 0) {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  const toggleChallenge = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (selected.length === 0 || !supabase || !user) return;
    setSaving(true);

    const labels = selected.map((id) => CHALLENGES.find((c) => c.id === id)?.label || id);

    await supabase
      .from('profiles')
      .update({ current_challenges: labels })
      .eq('id', user.id);

    // Refresh profile in AuthContext so dashboard sees the updated data
    await refreshProfile();

    router.replace('/dashboard');
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-cream)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: 'var(--color-cream)' }}>
      <div className="w-full max-w-sm flex flex-col gap-8">

        {step === 0 && (
          <>
            {/* Welcome */}
            <div className="text-center space-y-4">
              <div className="text-6xl">☀️</div>
              <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-text)' }}>
                day1 へようこそ
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-light)' }}>
                noteの記事を「読んだだけ」で終わらせず、<br />
                あなたの<strong style={{ color: 'var(--color-text)' }}>血肉</strong>にする。<br />
                それが day1 です。
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-light)' }}>
                まずはあなたのことを教えてください。<br />
                AIがあなたに合った学びを提案します。
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] shadow-md"
              style={{ background: 'var(--color-accent)' }}
            >
              はじめる →
            </button>
          </>
        )}

        {step === 1 && (
          <>
            {/* Challenge Selection */}
            <header className="text-center space-y-2">
              <h2 className="text-xl font-extrabold" style={{ color: 'var(--color-text)' }}>
                今、向き合いたいテーマは？
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-light)' }}>
                いくつでも選べます（あとで変更可能）
              </p>
            </header>

            <div className="grid grid-cols-2 gap-3">
              {CHALLENGES.map((ch) => {
                const isSelected = selected.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    onClick={() => toggleChallenge(ch.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all active:scale-[0.97]"
                    style={{
                      background: isSelected ? 'var(--color-accent)' : 'var(--color-card)',
                      border: isSelected ? '2px solid var(--color-accent-dark)' : '1px solid var(--color-border)',
                      color: isSelected ? '#fff' : 'var(--color-text)',
                      boxShadow: isSelected ? '0 4px 12px rgba(232, 168, 124, 0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <span className="text-2xl">{ch.emoji}</span>
                    <span className="text-xs font-bold leading-tight">{ch.label}</span>
                    <span
                      className="text-[10px] leading-tight"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--color-text-light)' }}
                    >
                      {ch.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSave}
                disabled={selected.length === 0 || saving}
                className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] shadow-md disabled:opacity-40"
                style={{ background: 'var(--color-accent)' }}
              >
                {saving ? '保存中...' : `${selected.length > 0 ? `${selected.length}つ選択中 — ` : ''}day1をはじめる ☀️`}
              </button>
              <button
                onClick={() => setStep(0)}
                className="text-xs font-medium"
                style={{ color: 'var(--color-text-light)' }}
              >
                ← 戻る
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
