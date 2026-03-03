'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface HistorySession {
  id: string;
  article_type: string | null;
  ai_summary: string;
  ai_generated_ideas: { id: string; text: string }[] | null;
  ai_generated_question: string | null;
  user_commitment: string | null;
  user_emotion_tags: string[] | null;
  user_reflection: string | null;
  check_in_status: string | null;
  completed_at: string;
  bookmark_id: string | null;
  bookmarks: { url: string; title: string } | null;
}

type FilterTab = 'all' | 'DO' | 'BE';

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;

    const { data, error } = await supabase
      .from('learning_sessions')
      .select(`
        id,
        article_type,
        ai_summary,
        ai_generated_ideas,
        ai_generated_question,
        user_commitment,
        user_emotion_tags,
        user_reflection,
        check_in_status,
        completed_at,
        bookmark_id,
        bookmarks (url, title)
      `)
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    if (!error && data) {
      setSessions(data as unknown as HistorySession[]);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // --- Derived data ---
  const doSessions = sessions.filter(s => s.article_type === 'DO');
  const beSessions = sessions.filter(s => s.article_type === 'BE');
  const filtered = activeFilter === 'all' ? sessions
    : sessions.filter(s => s.article_type === activeFilter);

  const pendingActions = doSessions.filter(s => s.check_in_status === 'pending' && s.user_commitment);
  const completedActions = doSessions.filter(s => s.check_in_status === 'completed');

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatDateTime = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-dvh flex items-center justify-center gradient-main">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col gradient-cool">

      {/* Header */}
      <header className="px-5 pt-6 pb-2 flex justify-between items-center">
        <h1 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>学習ノート</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="btn-ghost text-xs"
        >
          戻る
        </button>
      </header>

      {/* Stats Summary */}
      <section className="px-5 py-3">
        <div className="flex gap-2">
          <div className="flex-1 card p-3 text-center">
            <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--color-text)' }}>
              {sessions.length}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-dim)' }}>学習した記事</p>
          </div>
          <div className="flex-1 card p-3 text-center">
            <p className="text-2xl font-black tabular-nums" style={{ color: '#4A6AB0' }}>
              {doSessions.length}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-dim)' }}>アクション</p>
          </div>
          <div className="flex-1 card p-3 text-center">
            <p className="text-2xl font-black tabular-nums" style={{ color: '#7B5EA8' }}>
              {beSessions.length}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-dim)' }}>気づき</p>
          </div>
        </div>
      </section>

      {/* Pending Actions Banner */}
      {pendingActions.length > 0 && (
        <section className="px-5 pb-3">
          <div className="card-raised p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--g-coral)' }} />
              <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                未達成のアクション ({pendingActions.length})
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {pendingActions.slice(0, 3).map(s => (
                <div key={s.id} className="flex items-start gap-2">
                  <span className="text-[10px] mt-0.5 shrink-0 tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
                    {formatDate(s.completed_at)}
                  </span>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    {s.user_commitment}
                  </p>
                </div>
              ))}
              {pendingActions.length > 3 && (
                <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                  +{pendingActions.length - 3}件
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Filter Tabs */}
      <div className="px-5 flex gap-1 mb-3">
        {([
          { key: 'all' as FilterTab, label: `すべて (${sessions.length})` },
          { key: 'DO' as FilterTab, label: `アクション (${doSessions.length})` },
          { key: 'BE' as FilterTab, label: `気づき (${beSessions.length})` },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className="flex-1 py-2.5 text-[11px] font-semibold rounded-lg transition-all"
            style={{
              background: activeFilter === tab.key
                ? 'linear-gradient(135deg, var(--g-coral), var(--g-peach))'
                : 'var(--color-surface)',
              color: activeFilter === tab.key ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Session List */}
      <section className="flex-1 px-5 pb-8 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-dim)' }}>
              {activeFilter === 'all' ? 'まだ学習履歴がありません' :
                activeFilter === 'DO' ? 'アクションの記録がありません' : '気づきの記録がありません'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((session) => {
              const isExpanded = expandedId === session.id;
              const isDO = session.article_type === 'DO';
              const isBE = session.article_type === 'BE';
              const title = session.bookmarks?.title || session.ai_summary || 'タイトルなし';

              return (
                <li key={session.id}>
                  <button
                    onClick={() => toggleExpand(session.id)}
                    className="card w-full text-left transition-all active:scale-[0.99]"
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Card Content */}
                    <div className="p-4">
                      {/* Meta Row */}
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          {session.article_type ? (
                            <span className={`badge ${isDO ? 'badge-do' : 'badge-be'}`}>
                              {isDO ? 'DO' : 'BE'}
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--color-text-dim)' }}>旧版</span>
                          )}
                          <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
                            {formatDateTime(session.completed_at)}
                          </span>
                        </div>
                        {isDO && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: session.check_in_status === 'completed' ? 'rgba(90,148,98,0.12)' :
                                session.check_in_status === 'skipped' ? 'rgba(208,85,69,0.08)' : 'rgba(232,197,71,0.12)',
                              color: session.check_in_status === 'completed' ? 'var(--color-success)' :
                                session.check_in_status === 'skipped' ? 'var(--color-danger)' : '#B8972E',
                            }}
                          >
                            {session.check_in_status === 'completed' ? '✓ 達成' :
                              session.check_in_status === 'skipped' ? 'スキップ' : '未チェック'}
                          </span>
                        )}
                      </div>

                      {/* Article Title — subtle, secondary */}
                      <p className="text-[11px] font-medium mb-2 line-clamp-1" style={{ color: 'var(--color-text-dim)' }}>
                        {title}
                      </p>

                      {/* PRIMARY: User's Action/Reflection — prominent */}
                      {isDO && session.user_commitment && (
                        <div className="rounded-lg p-3 mb-1" style={{ background: 'rgba(74, 106, 176, 0.06)', border: '1px solid rgba(74, 106, 176, 0.10)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#4A6AB0' }}>
                            決めたアクション
                          </p>
                          <p className={`text-sm leading-relaxed font-medium ${isExpanded ? '' : 'line-clamp-2'}`} style={{ color: 'var(--color-text)' }}>
                            {session.user_commitment}
                          </p>
                        </div>
                      )}

                      {isBE && (
                        <div className="rounded-lg p-3 mb-1" style={{ background: 'rgba(123, 94, 168, 0.06)', border: '1px solid rgba(123, 94, 168, 0.10)' }}>
                          {session.user_emotion_tags && session.user_emotion_tags.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap mb-2">
                              {session.user_emotion_tags.map((tag, i) => (
                                <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(139, 107, 181, 0.12)', color: '#7B5EA8' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {session.user_reflection && (
                            <p className={`text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`} style={{ color: 'var(--color-text)' }}>
                              {session.user_reflection}
                            </p>
                          )}
                          {!session.user_reflection && !session.user_emotion_tags?.length && (
                            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>記録なし</p>
                          )}
                        </div>
                      )}

                      {/* Legacy sessions without article_type */}
                      {!session.article_type && (
                        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>旧バージョンの記録</p>
                      )}

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 flex flex-col gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                          {/* AI Question (BE) */}
                          {isBE && session.ai_generated_question && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-dim)' }}>AIからの問い</p>
                              <p className="text-xs leading-relaxed italic" style={{ color: 'var(--color-text-muted)' }}>
                                {session.ai_generated_question}
                              </p>
                            </div>
                          )}

                          {/* AI Ideas (DO) */}
                          {isDO && session.ai_generated_ideas && session.ai_generated_ideas.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-dim)' }}>AIの提案</p>
                              <div className="flex flex-col gap-1.5">
                                {session.ai_generated_ideas.map((idea, i) => (
                                  <p key={i} className="text-xs leading-relaxed pl-3" style={{
                                    color: idea.text === session.user_commitment ? 'var(--color-text)' : 'var(--color-text-muted)',
                                    fontWeight: idea.text === session.user_commitment ? 600 : 400,
                                    borderLeft: idea.text === session.user_commitment ? '2px solid #4A6AB0' : '2px solid var(--color-border)',
                                  }}>
                                    {idea.text}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Link to original article */}
                          {session.bookmarks?.url && (
                            <a
                              href={session.bookmarks.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium inline-flex items-center gap-1 mt-1"
                              style={{ color: 'var(--color-accent)' }}
                              onClick={e => e.stopPropagation()}
                            >
                              元の記事を読む →
                            </a>
                          )}
                        </div>
                      )}

                      {/* Expand indicator */}
                      <div className="flex justify-center mt-2">
                        <span className="text-[10px]" style={{
                          color: 'var(--color-text-dim)',
                          transform: isExpanded ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s',
                          display: 'inline-block',
                        }}>
                          ▼
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
