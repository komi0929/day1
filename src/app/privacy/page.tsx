'use client';

import Link from 'next/link';

export default function PrivacyPage() {
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
          プライバシーポリシー
        </h1>

        <div className="card p-6 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>

          <section>
            <p>株式会社ヒトコト（以下「当社」）は、Webアプリケーション「compass」（以下「本サービス」）における個人情報の取扱いについて、以下の通りプライバシーポリシーを定めます。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">1. 収集する情報</h2>
            <p>当社は、本サービスの提供にあたり、以下の情報を取得する場合があります。</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>入力データ</strong>: ユーザーが入力したnoteのURL、またはテキスト本文</li>
              <li><strong>AI処理データ</strong>: 入力テキストに基づきAIが生成した書籍推薦データ</li>
              <li><strong>端末情報</strong>: ブラウザの種類、OS、アクセス日時</li>
            </ul>
            <p className="mt-2">※ 本サービスはアカウント登録不要でご利用いただけます。メールアドレス等の個人情報は収集しません。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">2. 情報の利用目的</h2>
            <p>取得した情報は、以下の目的で利用します。</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>本サービスの提供（書籍推薦の生成）</li>
              <li>サービスの改善・品質向上</li>
              <li>不正利用の防止</li>
            </ol>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">3. 第三者への提供</h2>
            <p>当社は、以下の場合を除き、個人情報を第三者に提供しません。</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>ユーザーの同意がある場合</li>
              <li>法令に基づく場合</li>
              <li>人の生命・身体・財産の保護のために必要な場合</li>
            </ol>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">4. 外部サービスの利用</h2>
            <p>本サービスでは、以下の外部サービスを利用しています。各サービスのプライバシーポリシーをご確認ください。</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Google Gemini API</strong>: AI書籍推薦の生成（<a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--g-coral)' }}>プライバシーポリシー</a>）</li>
              <li><strong>Google Books API</strong>: 書籍情報・表紙画像の取得（<a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--g-coral)' }}>プライバシーポリシー</a>）</li>
              <li><strong>Vercel</strong>: ホスティング（<a href="https://vercel.com/legal/privacy-policy" className="underline" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--g-coral)' }}>プライバシーポリシー</a>）</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">5. データの保管</h2>
            <p>本サービスはユーザーのデータをサーバー上に永続的に保存しません。入力されたテキストはAI処理のためにのみ一時的に使用され、処理完了後はサーバー上に残りません。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">6. Cookieについて</h2>
            <p>本サービスでは、サービスの正常な動作に必要な最小限のCookieを使用する場合があります。広告目的では使用しません。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">7. アフィリエイトリンクについて</h2>
            <p>本サービスで表示される書籍のリンクには、Amazonアソシエイト・プログラムのアフィリエイトリンクが含まれます。リンク経由でご購入いただいた場合、当社に紹介料が支払われます。推薦する書籍の選定にアフィリエイトは影響しません。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">8. セキュリティ</h2>
            <p>当社は、情報の漏洩・滅失・毀損を防止するため、適切な安全管理措置を講じます。ただし、インターネット上の通信の完全な安全性を保証するものではありません。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">9. ポリシーの変更</h2>
            <p>当社は、必要に応じて本ポリシーを変更することがあります。変更後のポリシーは、本サービス上に掲載した時点から効力を生じるものとします。</p>
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
