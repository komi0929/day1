'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-dvh gradient-warm">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm mb-8"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← トップに戻る
        </Link>

        <h1 className="text-2xl font-extrabold mb-8" style={{ color: 'var(--color-text)' }}>
          利用規約
        </h1>

        <div className="card p-6 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>

          <section>
            <h2 className="font-bold text-base mb-2">第1条（適用）</h2>
            <p>本規約は、株式会社ヒトコト（以下「当社」）が提供するWebアプリケーション「あなたのための1冊」（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意したうえで、本サービスを利用するものとします。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">第2条（定義）</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>「ユーザー」とは、本サービスを利用するすべての方を指します。</li>
              <li>「コンテンツ」とは、本サービス上で表示・提供されるテキスト、画像、その他のデータを指します。</li>
              <li>「AI推薦」とは、ユーザーが入力した記事URLまたはテキストをもとにAIが生成する書籍推薦を指します。</li>
            </ol>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">第3条（サービスの内容）</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>本サービスは、ユーザーが入力したnote記事の内容をAIが分析し、書籍を推薦するサービスです。</li>
              <li>本サービスの利用にアカウント登録は不要です。</li>
              <li>推薦される書籍のリンクにはAmazonアソシエイト・プログラムのアフィリエイトリンクが含まれます。</li>
            </ol>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">第4条（禁止事項）</h2>
            <p>ユーザーは、以下の行為を行ってはなりません。</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>法令または公序良俗に反する行為</li>
              <li>当社または第三者の知的財産権、プライバシー権等を侵害する行為</li>
              <li>本サービスの運営を妨げる行為</li>
              <li>不正アクセスまたはこれを試みる行為</li>
              <li>AI推薦機能を悪用した大量リクエスト等の行為</li>
              <li>本サービスのスクレイピング機能を利用した第三者コンテンツの無断複製</li>
              <li>その他、当社が不適切と判断する行為</li>
            </ol>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">第5条（AI生成コンテンツについて）</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>本サービスで提供されるAI推薦は、Google Gemini APIを利用して自動生成されるものです。</li>
              <li>AI推薦の正確性・完全性・有用性について、当社は保証しません。推薦された書籍の内容が必ずしもユーザーの期待に沿うことを保証するものではありません。</li>
              <li>AI推薦は元記事の著作権を尊重し、個人的な書籍探索の支援を目的としています。</li>
            </ol>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">第6条（知的財産権）</h2>
            <p>本サービスに関する知的財産権は当社または正当な権利者に帰属します。ユーザーが入力した記事URLの元コンテンツに関する権利は、各コンテンツの権利者に帰属します。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">第7条（サービスの変更・停止）</h2>
            <p>当社は、事前の通知なく本サービスの内容を変更し、または提供を停止・中断することができます。これによりユーザーに生じた損害について、当社は一切の責任を負いません。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">第8条（免責事項）</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>当社は、本サービスの利用により生じた損害について、一切の責任を負いません。</li>
              <li>当社は、本サービスのバグ、中断、データの消失等について責任を負いません。</li>
              <li>AI推薦に基づく書籍購入の結果について、当社は責任を負いません。</li>
              <li>外部サイト（note.com、Amazon等）の利用に関するトラブルについて、当社は関与しません。</li>
            </ol>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">第9条（規約の変更）</h2>
            <p>当社は、必要と判断した場合、ユーザーへの事前の通知なく本規約を変更できます。変更後の利用規約は、本サービス上に掲示した時点から効力を生じるものとします。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">第10条（準拠法・管轄裁判所）</h2>
            <p>本規約は日本法に準拠し、本サービスに関する紛争については、当社本店所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</p>
          </section>

          <section className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p style={{ color: 'var(--color-text-muted)' }}>
              運営: 株式会社ヒトコト<br />
              代表: 小南優作<br />
              お問い合わせ: <a href="mailto:y.kominami@hitokoto1.co.jp" className="underline" style={{ color: 'var(--g-coral)' }}>y.kominami@hitokoto1.co.jp</a>
            </p>
            <p className="mt-2" style={{ color: 'var(--color-text-dim)' }}>
              制定日: 2026年3月3日 / 改定日: 2026年3月5日
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
