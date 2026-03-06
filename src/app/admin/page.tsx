'use client';

import { useState, useEffect, useCallback } from 'react';

/* ─── Types ─── */
interface KPIData {
  uniqueSessions: number;
  urlSubmits: number;
  recommendCompletes: number;
  bookmarkTaps: number;
  letterOpens: number;
  amazonClicks: number;
  loadMoreTaps: number;
  signupModals: number;
  cardSwipes: number;
  flowCompletionRate: number;
  cardEngageRate: number;
  loadMoreRate: number;
  thumbnailHitRate: number;
  p50Duration: number;
  errorCount: number;
  totalBooks: number;
  thumbnailHits: number;
}

interface FunnelStep { step: string; count: number; }
interface Flag { id: string; enabled: boolean; description: string; updated_at: string; }

interface DashboardData {
  dates: { today: string; yesterday: string; dayBefore: string };
  today: KPIData;
  yesterday: KPIData;
  dayBefore: KPIData;
  funnel: FunnelStep[];
  flags: Flag[];
  generatedAt: string;
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('secret');
    if (s) {
      setSecret(s);
      setAuthenticated(true);
    }
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/dashboard?secret=${encodeURIComponent(secret)}`);
      if (!res.ok) {
        if (res.status === 401) { setError('認証エラー'); setAuthenticated(false); }
        else setError('データ取得失敗');
        return;
      }
      const d = await res.json();
      setData(d);
      setAuthenticated(true);
    } catch {
      setError('接続エラー');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    if (authenticated && secret) fetchData();
  }, [authenticated, secret, fetchData]);

  // Toggle flag
  const toggleFlag = async (flagId: string, current: boolean) => {
    try {
      await fetch(`/api/admin/flags?secret=${encodeURIComponent(secret)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: flagId, enabled: !current }),
      });
      fetchData(); // Refresh
    } catch {
      alert('フラグ更新失敗');
    }
  };

  // Auth gate
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f13', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: '#1a1a24', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '360px', width: '100%' }}>
          <h1 style={{ color: '#fff', fontSize: '20px', marginBottom: '24px' }}>🧭 Compass Admin</h1>
          <input type="password" placeholder="Admin Secret" value={secret} onChange={e => setSecret(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setAuthenticated(true); }}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #333', background: '#0f0f13', color: '#fff', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
          />
          <button onClick={() => setAuthenticated(true)}
            style={{ width: '100%', marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'linear-gradient(135deg, #E8655A, #F2A87C)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            ログイン
          </button>
          {error && <p style={{ color: '#f66', marginTop: '12px', fontSize: '12px' }}>{error}</p>}
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f13', color: '#888' }}>
        ロード中...
      </div>
    );
  }

  if (!data) return null;

  const { today, yesterday, dayBefore, funnel, flags, dates } = data;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', color: '#e0e0e0', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: 0 }}>🧭 Morning Assembly</h1>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            {dates.yesterday}（昨日） vs {dates.dayBefore}（一昨日）| 更新: {new Date(data.generatedAt).toLocaleTimeString('ja-JP')}
          </p>
        </div>
        <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: '8px', background: '#222', color: '#aaa', border: '1px solid #333', cursor: 'pointer', fontSize: '12px' }}>
          🔄 更新
        </button>
      </header>

      {/* ═══ Tier 1: 毎朝の3つの数字 ═══ */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={sectionTitle}>📊 Tier 1 — 毎朝の3つの数字</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <KPICard label="フロー完了率" value={`${yesterday.flowCompletionRate}%`} prev={`${dayBefore.flowCompletionRate}%`}
            target="80%" status={yesterday.flowCompletionRate >= 80 ? 'good' : yesterday.flowCompletionRate >= 60 ? 'warn' : 'bad'} />
          <KPICard label="エンゲージ率" value={`${yesterday.cardEngageRate}%`} prev={`${dayBefore.cardEngageRate}%`}
            target="50%" status={yesterday.cardEngageRate >= 50 ? 'good' : yesterday.cardEngageRate >= 30 ? 'warn' : 'bad'} />
          <KPICard label="追加検索率" value={`${yesterday.loadMoreRate}%`} prev={`${dayBefore.loadMoreRate}%`}
            target="35%" status={yesterday.loadMoreRate >= 35 ? 'good' : yesterday.loadMoreRate >= 20 ? 'warn' : 'bad'} />
        </div>
      </section>

      {/* ═══ Today's Live Counter ═══ */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={sectionTitle}>⚡ 今日のリアルタイム</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
          <MiniCard label="セッション" value={today.uniqueSessions} />
          <MiniCard label="URL送信" value={today.urlSubmits} />
          <MiniCard label="結果表示" value={today.recommendCompletes} />
          <MiniCard label="しおり" value={today.bookmarkTaps} />
          <MiniCard label="追加検索" value={today.loadMoreTaps} />
          <MiniCard label="Amazon" value={today.amazonClicks} />
        </div>
      </section>

      {/* ═══ ファネル ═══ */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={sectionTitle}>🔽 昨日のファネル</h2>
        <div style={{ background: '#1a1a24', borderRadius: '12px', padding: '20px' }}>
          {funnel.map((step, i) => {
            const maxCount = funnel[0]?.count || 1;
            const pct = maxCount > 0 ? Math.round((step.count / maxCount) * 100) : 0;
            const dropoff = i > 0 && funnel[i - 1].count > 0
              ? Math.round(((funnel[i - 1].count - step.count) / funnel[i - 1].count) * 100)
              : 0;
            return (
              <div key={i} style={{ marginBottom: i < funnel.length - 1 ? '12px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>{step.step}</span>
                  <span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{step.count}</span>
                    {i > 0 && <span style={{ color: dropoff > 30 ? '#f66' : '#888', marginLeft: '8px' }}>−{dropoff}%</span>}
                  </span>
                </div>
                <div style={{ height: '8px', background: '#0f0f13', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '4px', width: `${pct}%`,
                    background: pct > 60 ? 'linear-gradient(90deg, #4CAF50, #8BC34A)' : pct > 30 ? 'linear-gradient(90deg, #FF9800, #FFC107)' : 'linear-gradient(90deg, #f44336, #FF5722)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ Tier 3: 品質指標 ═══ */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={sectionTitle}>🔧 品質指標</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <MiniCard label="表紙ヒット率" value={`${yesterday.thumbnailHitRate}%`} sub={`${yesterday.thumbnailHits}/${yesterday.totalBooks}`} />
          <MiniCard label="API p50" value={`${yesterday.p50Duration}ms`} />
          <MiniCard label="エラー数" value={yesterday.errorCount} warn={yesterday.errorCount > 0} />
          <MiniCard label="手紙展開" value={yesterday.letterOpens} />
          <MiniCard label="スワイプ" value={yesterday.cardSwipes} />
          <MiniCard label="モーダル表示" value={yesterday.signupModals} />
        </div>
      </section>

      {/* ═══ Feature Flags ═══ */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={sectionTitle}>🎚️ Feature Flags</h2>
        <div style={{ background: '#1a1a24', borderRadius: '12px', padding: '20px' }}>
          {flags.map((flag) => (
            <div key={flag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #222' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{flag.id}</span>
                <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{flag.description}</p>
              </div>
              <button onClick={() => toggleFlag(flag.id, flag.enabled)} style={{
                width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer', position: 'relative',
                background: flag.enabled ? '#4CAF50' : '#333', transition: 'background 0.2s',
              }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '10px', background: '#fff', position: 'absolute', top: '3px',
                  left: flag.enabled ? '25px' : '3px', transition: 'left 0.2s',
                }} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Raw Numbers Comparison ═══ */}
      <section>
        <h2 style={sectionTitle}>📋 昨日 vs 一昨日 — 生数値</h2>
        <div style={{ background: '#1a1a24', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={th}>指標</th>
                <th style={th}>昨日</th>
                <th style={th}>一昨日</th>
                <th style={th}>変化</th>
              </tr>
            </thead>
            <tbody>
              {([
                ['セッション数', yesterday.uniqueSessions, dayBefore.uniqueSessions],
                ['URL送信', yesterday.urlSubmits, dayBefore.urlSubmits],
                ['結果表示', yesterday.recommendCompletes, dayBefore.recommendCompletes],
                ['しおり', yesterday.bookmarkTaps, dayBefore.bookmarkTaps],
                ['手紙展開', yesterday.letterOpens, dayBefore.letterOpens],
                ['Amazon', yesterday.amazonClicks, dayBefore.amazonClicks],
                ['追加検索', yesterday.loadMoreTaps, dayBefore.loadMoreTaps],
                ['カードスワイプ', yesterday.cardSwipes, dayBefore.cardSwipes],
              ] as [string, number, number][]).map(([label, curr, prev], i) => {
                const diff = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={td}>{label}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#fff' }}>{curr}</td>
                    <td style={td}>{prev}</td>
                    <td style={{ ...td, color: diff > 0 ? '#4CAF50' : diff < 0 ? '#f44336' : '#666' }}>
                      {diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ═══ Sub-components ═══ */

const sectionTitle: React.CSSProperties = {
  fontSize: '14px', fontWeight: 700, color: '#888', marginBottom: '12px', letterSpacing: '1px',
};

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', color: '#666', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px', color: '#aaa' };

function KPICard({ label, value, prev, target, status }: {
  label: string; value: string; prev: string; target: string;
  status: 'good' | 'warn' | 'bad';
}) {
  const bg = status === 'good' ? 'rgba(76, 175, 80, 0.1)' : status === 'warn' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(244, 67, 54, 0.1)';
  const accent = status === 'good' ? '#4CAF50' : status === 'warn' ? '#FF9800' : '#f44336';
  return (
    <div style={{ background: '#1a1a24', borderRadius: '12px', padding: '20px', border: `1px solid ${accent}30` }}>
      <p style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '32px', fontWeight: 800, color: '#fff', margin: '4px 0' }}>{value}</p>
      <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
        <span style={{ color: '#666' }}>前日: {prev}</span>
        <span style={{ color: accent, background: bg, padding: '2px 6px', borderRadius: '4px' }}>目標: {target}</span>
      </div>
    </div>
  );
}

function MiniCard({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div style={{ background: '#1a1a24', borderRadius: '10px', padding: '14px', border: warn ? '1px solid #f4433640' : '1px solid #222' }}>
      <p style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 700, color: warn ? '#f44336' : '#fff', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{sub}</p>}
    </div>
  );
}
