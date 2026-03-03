'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-dvh gradient-warm">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm mb-8"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← 戻る
        </Link>

        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter text-gradient mb-3">
            day1
          </h1>
          <p className="text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>
            今日の朝を、学びではじめよう
          </p>
        </div>

        <div className="flex flex-col gap-6">

          {/* What is day1? */}
          <section className="card p-6">
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text)' }}>
              day1とは？
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              「読んで終わり」をなくすための学習アプリです。
              noteの記事をただ読むだけではなく、AIがあなたの今の状況に合わせて「次に何をすべきか」を一緒に考えてくれます。
              読んだ知識を、明日の行動に変える。それがday1です。
            </p>
          </section>

          {/* How it works */}
          <section className="card p-6">
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-text)' }}>
              使い方
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex gap-3 items-start">
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))' }}>
                  1
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>記事を追加する</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    noteの記事URLをダッシュボードに貼り付けるか、共有機能からday1に送ります。
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))' }}>
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>AIと一緒に学ぶ</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    AIが記事を分析し、「アクション型（DO）」なら具体的な行動を提案、「気づき型（BE）」なら深い問いかけをしてくれます。
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--g-coral), var(--g-peach))' }}>
                  3
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>行動して、振り返る</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    アクションを決めて実行し、学習ノートで達成状況を振り返り。学びが「自分の成長記録」になります。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* DO / BE */}
          <section className="card p-6">
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text)' }}>
              2つの学び方
            </h2>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg p-3" style={{ background: 'rgba(74, 106, 176, 0.06)', border: '1px solid rgba(74, 106, 176, 0.10)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="badge badge-do">DO</span>
                  <span className="text-sm font-semibold" style={{ color: '#4A6AB0' }}>アクション型</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  ノウハウやHow-to系の記事に最適。AIが3つの具体的なアクションを提案し、あなたが1つ選んでコミットします。翌朝、実行できたかチェックインします。
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'rgba(123, 94, 168, 0.06)', border: '1px solid rgba(123, 94, 168, 0.10)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="badge badge-be">BE</span>
                  <span className="text-sm font-semibold" style={{ color: '#7B5EA8' }}>気づき型</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  エッセイや思想系の記事に最適。AIが深い問いかけを投げかけ、あなたの感情や気づきを言葉にする時間を提供します。
                </p>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="card p-6">
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text)' }}>
              特徴
            </h2>
            <ul className="flex flex-col gap-2.5">
              <li className="flex gap-2 items-start text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="shrink-0 mt-0.5" style={{ color: 'var(--g-sage)' }}>●</span>
                <span><strong style={{ color: 'var(--color-text)' }}>あなた専用のAI</strong> — オンボーディングで設定したあなたの課題に基づいて、記事から最適な学びを抽出します</span>
              </li>
              <li className="flex gap-2 items-start text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="shrink-0 mt-0.5" style={{ color: 'var(--g-blue)' }}>●</span>
                <span><strong style={{ color: 'var(--color-text)' }}>PWA対応</strong> — ホーム画面に追加してアプリのように使えます。noteアプリからの共有にも対応</span>
              </li>
              <li className="flex gap-2 items-start text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="shrink-0 mt-0.5" style={{ color: 'var(--g-violet)' }}>●</span>
                <span><strong style={{ color: 'var(--color-text)' }}>学習ノート</strong> — 過去の学びを一覧で振り返り。アクション・気づき別にフィルターできます</span>
              </li>
              <li className="flex gap-2 items-start text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="shrink-0 mt-0.5" style={{ color: 'var(--g-coral)' }}>●</span>
                <span><strong style={{ color: 'var(--color-text)' }}>Xシェア</strong> — 学びの成果をワンタップでXに共有。アウトプットの習慣化に</span>
              </li>
            </ul>
          </section>

          {/* Company info */}
          <section className="card p-6">
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text)' }}>
              運営情報
            </h2>
            <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              <p>運営: 株式会社ヒトコト</p>
              <p>代表: 小南優作</p>
              <p className="mt-2">
                お問い合わせ:{' '}
                <a href="mailto:y.kominami@hitokoto1.co.jp" className="underline" style={{ color: 'var(--color-accent)' }}>
                  y.kominami@hitokoto1.co.jp
                </a>
              </p>
            </div>
          </section>

          {/* Links */}
          <div className="flex justify-center gap-4 text-xs pb-4" style={{ color: 'var(--color-text-dim)' }}>
            <Link href="/terms" className="underline hover:opacity-80">利用規約</Link>
            <Link href="/privacy" className="underline hover:opacity-80">プライバシーポリシー</Link>
          </div>

        </div>
      </div>
    </main>
  );
}
