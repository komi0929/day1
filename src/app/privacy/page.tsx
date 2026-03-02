'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh gradient-warm">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm mb-8"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← 戻る
        </Link>

        <h1 className="text-2xl font-extrabold mb-8" style={{ color: 'var(--color-text)' }}>
          プライバシーポリシー
        </h1>

        <div className="card p-6 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>

          <section>
            <p>株式会社ヒトコト（以下「当社」）は、Webアプリケーション「day1」（以下「本サービス」）における個人情報の取扱いについて、以下の通りプライバシーポリシーを定めます。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">1. 収集する情報</h2>
            <p>当社は、本サービスの提供にあたり、以下の情報を収集します。</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>アカウント情報</strong>: メールアドレス、表示名（Google認証の場合はGoogleアカウント情報）</li>
              <li><strong>利用データ</strong>: 学習履歴（チェックイン日時、学習記事のURL・タイトル）、連続学習日数</li>
              <li><strong>AI生成データ</strong>: ユーザーが入力した記事URL・テキストに基づくAI要約データ</li>
              <li><strong>端末情報</strong>: ブラウザの種類、OS、アクセス日時</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">2. 情報の利用目的</h2>
            <p>収集した情報は、以下の目的で利用します。</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>本サービスの提供・運営・改善</li>
              <li>ユーザー認証およびアカウント管理</li>
              <li>学習履歴の記録・表示</li>
              <li>AI要約の生成・提供</li>
              <li>利用状況の分析（サービス改善目的）</li>
              <li>不正利用の防止</li>
              <li>ユーザーへの重要なお知らせの通知</li>
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
              <li><strong>Supabase</strong>: 認証・データベース（<a href="https://supabase.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>）</li>
              <li><strong>Google Gemini API</strong>: AI要約生成（<a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>）</li>
              <li><strong>Vercel</strong>: ホスティング（<a href="https://vercel.com/legal/privacy-policy" className="underline" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>）</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">5. データの保管</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>ユーザーデータはSupabase（AWSインフラ）上に暗号化して保管されます。</li>
              <li>アカウント削除を希望される場合は、お問い合わせ先までご連絡ください。</li>
            </ol>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">6. Cookieについて</h2>
            <p>本サービスでは、認証情報の維持のためにCookieおよびローカルストレージを使用します。これらはサービスの正常な動作に必要なものであり、広告目的では使用しません。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">7. セキュリティ</h2>
            <p>当社は、個人情報の漏洩・滅失・毀損を防止するため、適切な安全管理措置を講じます。ただし、インターネット上の通信の完全な安全性を保証するものではありません。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">8. ユーザーの権利</h2>
            <p>ユーザーは、当社が保有する自己の個人情報について、開示・訂正・削除を請求する権利を有します。ご希望の場合は、下記お問い合わせ先までご連絡ください。</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2">9. ポリシーの変更</h2>
            <p>当社は、必要に応じて本ポリシーを変更することがあります。変更後のポリシーは、本サービス上に掲載した時点から効力を生じるものとします。</p>
          </section>

          <section className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p style={{ color: 'var(--color-text-muted)' }}>
              運営: 株式会社ヒトコト<br />
              代表: 小南優作<br />
              お問い合わせ: <a href="mailto:y.kominami@hitokoto1.co.jp" className="underline">y.kominami@hitokoto1.co.jp</a>
            </p>
            <p className="mt-2" style={{ color: 'var(--color-text-dim)' }}>
              制定日: 2026年3月3日
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
