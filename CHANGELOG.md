# Changelog

## [2026-03-06] — セキュリティ監査・修正

### 🔒 Security
- 認証トークンをリクエストBodyからAuthorizationヘッダーに移行（ログ/キャッシュ漏洩防止）
- Content-Security-Policy ヘッダー追加（XSS防止、リソース読み込み制限）
- リクエストボディサイズ制限追加（recommend: 16KB上限）
- レートリミッター導入（scrape: 5回/分、recommend: 3回/分、IP別）
- XSS監査完了（dangerouslySetInnerHTML不使用を確認）
- 全認証APIでgetUser()による検証を確認

## [2026-03-06] — メールアドレス認証追加

### ✨ Feature
- メールアドレス + パスワードでの新規登録・ログインに対応
- `/library` ログイン画面にAuthForm追加（Google OAuth + メール / 切替可能）
- メール確認後の温かい案内メッセージ（「本棚の鍵を開けてください」）

## [2026-03-06] — かかりつけ私設図書館機能

### ✨ Feature
- Google OAuth認証（摩擦のないログイン）
- マイライブラリ（`/library`）— 2タブ構成: 「これまでに綴った言葉たち」「いつか読む本」
- 「🔖 しおりをはさむ」ボタン（各書籍カードに追加）
- 感動のピークでの登録モーダル（「本棚をつくる（無料）」）
- 心のカルテ（裏側でLLMが200字の心理要約を生成・蓄積）
- 継続カウンセリング（過去カルテを元に手紙の冒頭で時間経過・変化に言及）
- LocalStorage一時保存 → ログイン後DB紐付け
- 選書履歴自動保存

### 🔧 Config
- Supabase DBスキーマ（profiles, selections, bookmarks, heart_profiles）
- 5つの新規APIルート: save-selection, bookmarks, library, heart-profile + recommend拡張
- AuthProvider + Providersラッパー

## [2026-03-06] — 自律開発の仕組み化

### 🔧 Config
- `GEMINI.md` に「自律完遂ルール」セクション追加（中間確認の明示的禁止、自己判断リスト、報告フォーマット）
- `/pre-release` ワークフロー新設（7項目の自動チェックリスト）
- `/consistency-check` ワークフロー新設（名称・システム用語・メタ情報の自動整合性検証）
- `/auto-record` ワークフローに一貫性チェック前提ステップ追加

### 🗑️ Cleanup
- デッドコード削除: `supabase.ts`, `auth-context.tsx`, `security.ts`（現アプリで未使用）
- 旧スキーマ削除: `supabase_schema.sql`, `supabase_migration_v2.sql`

## [2026-03-06] — リリース準備修正

### 🐛 Bug Fix
- 利用規約・プライバシーポリシーのサービス名を「compass」に統一
- `robots.txt` を更新（旧day1ルート削除、ドメインをcompassに変更）

## [2026-03-06] — compass 温かい文言リライト

### ✨ Feature
- アプリ全体の文言を「compass」ブランドの温かいトーン＆マナーに全面刷新
- メインコピー: 「あなたの書いたnoteから「今読んでほしい一冊」をおすすめするアプリ」
- LLMシステムプロンプトを「体温を感じる編集者」ペルソナに書き換え
- 「AI」「推論」「スクレイピング」「エラー」等のシステム用語を完全排除

### 🔧 Config
- `GEMINI.md` プロジェクト名を「Compass」に修正、フリーズ防止ルール追加
- `manifest.json` を compass ブランディングに更新
- meta/OGP情報をcompassコンセプトに統一

## [2026-03-06]

### 🔧 Config
- 自律開発環境リフレッシュ: `GEMINI.md` プロジェクト名を「notememo」に修正、フリーズ防止ルール追加
- `browser-verify.md` にタイムアウト時エスカレーション条項追加
- 前回セッションのフリーズ対策として5項目のフリーズ防止ルールを策定

## [2026-03-05] — プロダクト抜本リビルド

### 🚀 Release Preparation
- TOPページにサービス概要（ヒーロー + 3ステップ使い方 + フッター）追加
- 利用規約ページ再作成（書籍推薦・アフィリエイト・スクレイピングに対応）
- プライバシーポリシーページ再作成（アカウント不要化・アフィリエイト開示・データ非永続化）
- Amazonアソシエイトタグを環境変数化（`AMAZON_ASSOCIATE_TAG`）
- フッターに利用規約・プライバシーポリシーリンク、著作権表記追加

### ✨ Feature
- **「あなたのための1冊」— note URL→書籍推薦アプリ**に全面リビルド
  - note URLスクレイピング（5段階フォールバック戦略: JSON-LD / OG / note-body / article / __NEXT_DATA__）
  - 取得失敗時のテキスト直接入力フォールバックUI
  - Gemini 2.5 Flash によるディープ・プロファイリング（立場・悩み・課題感・隠れた願望を推論）
  - 9冊の書籍一括推薦（ラベル / ヘッドライン / ヒトコト / 書籍概要 / 手紙形式推薦文 / Amazonリンク）
  - Google Books APIによる表紙画像自動取得
  - 3冊ずつページネーション表示（計3ページ、待機ゼロで即表示）
  - 30秒没入型待機体験（note本文からの一節フェードイン・アウト表示）
  - スマホ横スワイプ対応、PC 3列グリッドレスポンシブ

### 🎨 Design
- 「深夜の私設図書館」ダークテーマに全面刷新
  - アナログ暖色パレット（amber/gold/peach）を維持しつつダークモード化
  - ノイズテクスチャ＆グレイニーグラデーション完全維持
  - 書籍カード: 表紙画像大表示＋立体的シャドウ＋革装丁風UI
  - 手紙形式推薦文の特別スタイリング
  - 明朝体ベースのタイポグラフィ（Hiragino Mincho / Noto Serif JP）
  - フォールバック書籍カバー画像生成・配置

### 🗑️ Cleanup
- 旧Compassアプリの全ルート削除（/workspace, /library, /login, /privacy, /terms）
- 旧API削除（/api/extract, /api/delete-account）
- AuthProvider / Supabase認証依存を削除（パブリックアプリ化）

## [2026-03-05]

### ⬆️ Upgrade
- AIモデルを Gemini 2.0 Flash → **Gemini 2.5 Flash (Thinking model)** にアップグレード
  - 深い推論（chain-of-thought）による分析品質向上
  - temperature: 0.9→0.8、maxOutputTokens: 8192→65536に調整
  - Thinkingモデルのmarkdownコードフェンス対応JSONパース追加

## [2026-03-04]

### ♻️ Refactor
- ワークスペースUI改善: 自分のもやもやをnote貼付スタイルに変更（強調枠+説明文付き）
- 「他者の言葉」→「noteで見つけた気になる言葉」にリブランド
- タイトルフィールド削除、URLをサブ要素に格下げ、気になる言葉をメインUI要素に昇格
- AIプロンプト強化: ユーザー自身のnoteを「最重要・熟読」指示に変更
- 文字数上限をもやもや2000→5000に拡大
- Library一覧の引用タグを抜粋テキストプレビューに変更
- Library詳細の引用表示を言葉中心+URLサブリンクに変更

### ✨ Feature
- Compassアプリとして抜本的リビルド
  - もやもや × noteの横断分析AIインサイト・エクストラクション
  - PC向けスプリットビュー・ワークスペース（左: Input Pool / 右: Output Board）
  - Insight Library（アーカイブ一覧 + 詳細ドキュメント表示）
  - Gemini 2.0 Flash による Title / Thread / Now / Be / Do 構造化分析
  - Supabase新スキーマ（insights + note_sources テーブル）

### 🎨 Design
- ノイズテクスチャ＆グレイニーグラデーションを完全維持
- インサイト表示の美しいタイポグラフィ（Thread/Now/Be/Doカラーラベル）
- ナビバー、ソースカード、ライブラリカードのグラスモーフィズムUI

### 🔧 Config
- 自律開発環境セットアップ（GEMINI.md, ワークフロー, CHANGELOG.md）
