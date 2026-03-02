'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const CHALLENGES = [
  { id: 'career', label: '仕事 / キャリア', description: '成長・転職・スキルアップ' },
  { id: 'relationships', label: '人間関係', description: 'コミュニケーション・信頼' },
  { id: 'mindset', label: 'マインド / メンタル', description: '思考法・ストレス・自己理解' },
  { id: 'money', label: 'お金 / 資産', description: '貯蓄・投資・経済的自由' },
  { id: 'health', label: '健康 / ライフスタイル', description: '習慣・運動・食事・睡眠' },
  { id: 'skills', label: 'スキルアップ', description: '学習法・読書・資格' },
  { id: 'creativity', label: '創造性 / 表現', description: '発想力・アウトプット・副業' },
  { id: 'purpose', label: '生き方 / 哲学', description: '価値観・人生の方向性' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, profile, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

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

    await refreshProfile();
    router.replace('/dashboard');
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 gradient-warm">
      <div className="w-full max-w-sm flex flex-col gap-8">

        {step === 0 && (
          <>
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-black text-gradient">
                day1 へようこそ
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                noteの記事を「読んだだけ」で終わらせず、<br />
                あなたの<strong style={{ color: 'var(--color-text)' }}>血肉</strong>にする。<br />
                それが day1 です。
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
                まずはあなたのことを教えてください。<br />
                AIがあなたに合った学びを提案します。
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="btn-primary w-full"
            >
              はじめる
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <header className="text-center space-y-2">
              <h2 className="text-xl font-extrabold" style={{ color: 'var(--color-text)' }}>
                今、向き合いたいテーマは？
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
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
                      background: isSelected
                        ? 'linear-gradient(135deg, var(--g-coral), var(--g-peach))'
                        : 'var(--color-surface)',
                      border: isSelected ? '1px solid rgba(232, 168, 124, 0.4)' : '1px solid var(--color-border)',
                      color: isSelected ? '#fff' : 'var(--color-text)',
                    }}
                  >
                    <span className="text-xs font-bold leading-tight">{ch.label}</span>
                    <span
                      className="text-[10px] leading-tight"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--color-text-dim)' }}
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
                className="btn-primary w-full"
              >
                {saving ? '保存中...' : `${selected.length > 0 ? `${selected.length}つ選択中 — ` : ''}day1をはじめる`}
              </button>
              <button
                onClick={() => setStep(0)}
                className="text-xs font-medium"
                style={{ color: 'var(--color-text-dim)' }}
              >
                戻る
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
