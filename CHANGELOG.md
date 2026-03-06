# Changelog

## [2026-03-07] — 表紙画像: AI生成ISBN廃止 → NDL検索で正しいISBN取得

### 🐛 Critical Fix (表紙表示率を大幅改善)
- **AIプロンプトからISBN出力を完全除去**: AIがISBNを「生成」（ハルシネーション）していたことが表紙未表示の根本原因
- **NDL OpenSearch APIでタイトル検索**: AIが選書した書名でNDL（国立国会図書館）を検索し、**実在する正しいISBN-13**を取得
- **フロー変更**: AI選書(タイトル+著者) → NDL検索(ISBN取得) → openBDカバーURL構築
- **3冊並列検索**: Promise.allで全書籍を同時にNDL検索（レイテンシ最小化）
- **CSPに`cover.openbd.jp`追加**: 前回のCSP未登録問題も修正済み

## [2026-03-06] — 表紙画像の解決を完全サーバーサイド事前検証へ移行

### ✨ UX Enhancement / Critical Fix
- **フロントエンドのフォールバック廃止**: ユーザー画面で画像が404になってから切り替わる「チラつき（Layout Shift）」や「リンク切れ表示」を根絶するため、`page.tsx`の多段エラーハンドリングを全削除。シンプルな`<img src="確実なURL">`のみの極小コードへリファクタリング。
- **サーバーサイドでの並行死活監視**: `api/recommend/route.ts`にて、LLMが選書した時点で`Promise.all`を用いて全書籍の画像URLを同時に数秒内で死活監視（HEADリクエスト＋AbortControllerによるタイムアウト）するよう変更。優先順位は「1.版元ドットコム(openBD) → 2.NDL → 3.default-cover」とし、クライアントには常に有効なURLのみを返却。

## [2026-03-06] — 3回目以降の「裏での追加選書」が動かないバグを修正

### 🐛 Critical Fix
- **プレフェッチ（事前読み込み）の動的化**: 先ほどの実装では「最初の3冊が表示された直後（2回目の選書時）」のみ裏で読み込むようハードコードされていた不具合を修正。ユーザーが新しく読み込まれたバッチを閲覧し始めたタイミングで、自動的に次のバッチ（3回目、4回目...）を裏で読み込む完全な動的プレフェッチを実現。

## [2026-03-06] — 選書ロジックの「洋書偏重」バグ修正

### 🐛 Critical Fix
- **選書の偏り解消**: プロンプトから「和書・洋書いずれも可」という記述を削除し、「主に日本の著者の和書から選書すること（note文脈と極めて合致する場合のみ海外の翻訳書も可）」という強い指定に変更することで、当初のコンセプトバランスを取り戻した

## [2026-03-06] — 追加選書の完全バックグラウンド化 & 表紙フォールバック修正

### ✨ UX Overhaul & 🐛 Critical Fix
- **裏での事前選書（バックグラウンドPre-fetch）完全実装**: ユーザーが「ボタンを押してから待つ」のではなく、最初の3冊が表示された直後に**裏で自動的に4〜6冊目を取得開始**するよう修正。ユーザーの読書を邪魔しないよう、取得完了時の自動スワイプも停止
- **表紙フォールバック画像修正**: 表紙画像が取得できなかった（404等）場合、古い「テキストのみのCSSプレースホルダー」が表示されてしまうバグを修正し、Compassの世界観に合わせた `default-cover.png` が美しく表示されるように変更

## [2026-03-06] — 表紙画像: サーバーサイドHEAD廃止 + NDL直構築

### 🐛 Critical Fix
- **Vercel関数タイムアウト解消**: 版元ドットコム（DNS到達不可→3秒×3冊=9秒浪費）+NDL HEAD検証を全廃止
- **同期NDL URL構築**: isbn→NDL URLを0msで構築、クライアント側`img onError`で404時にdefault-cover.pngへフォールバック
- **googleSearch tool型修正**: `as never`キャスト除去、`any[]`で正しく渡す
- **ISBNデバッグログ追加**: Vercelログで各書籍のISBN取得状況を確認可能

## [2026-03-06] — 本棚UX全面改修「思い出のタイムライン」

### 🎨 UX Overhaul
- **タブ廃止 → タイムラインUI**: DB構造に依存したHistoryTab/BookmarksTabを廃止し、時系列で選書記録が並ぶ「軌跡モード」に統合
- **BookDetailModal**: 本をタップで手紙付き詳細モーダル表示。当時のnote一節 → 手紙 → 「Amazonでこの本を迎え入れる」CTAのエモーショナルフロー
- **しおりフィルター**: 「🔖 しおりをはさんだ本だけ」トグルで本棚モード切替
- **本ごとのアクション**: ホバー/タップで🔖しおり・✕非表示ボタン表示

### 🐛 Critical Fix
- **localStorageデータ移行**: 未ログイン時の`compass_pending`/`compass_bookmarks`をログイン直後にDB移行 → localStorage削除

## [2026-03-06] — 表紙画像: Search Grounding + 3段階フォールバック

### 🔧 Overhaul
- **Gemini Search Grounding有効化**: AIが書籍推薦時にGoogle検索でISBNの実在を確認するよう強制（ハルシネーション対策）
- **Google Books API削除**: 日本語書籍カバレッジ0%のため完全撤去
- **3段階表紙取得**: 版元ドットコム → NDL → 美しいデフォルトカバー
  - 版元ドットコム（`cover.hanmoto.com`）: 日本出版業界公式DB、APIキー不要
  - NDL: 国立国会図書館サムネイル（既存、HEAD検証付き）
  - デフォルト: Compass世界観に馴染む水彩画風カバー画像
- **CSP更新**: `cover.hanmoto.com`追加、未使用のGoogle Books系ドメイン削除
- **JSON+Grounding両立**: `responseMimeType:'application/json'`はGroundingと競合するため、テキスト出力+手動JSON解析に変更

## [2026-03-06] — CPO数値管理システム（Morning Assembly）

### ✨ Feature
- **Admin Dashboard** (`/admin`): 毎朝の意思決定ダッシュボード
  - Tier 1 KPI: フロー完了率・エンゲージ率・追加検索率（昨日 vs 一昨日比較）
  - ファネルチャート: TOP → URL送信 → 結果 → しおり の通過率・離脱率を可視化
  - リアルタイム今日カウンター
  - 品質指標: 表紙ヒット率, API p50, エラー数
  - Feature Flags: 管理画面からワンタップで機能ON/OFF
- **Analytics基盤** (`src/lib/analytics.ts`): 14種類のフロントイベント計測（fire-and-forget, sendBeacon）
- **Feature Flags**: 5フラグ（Google Books fallback, 追加検索, 登録モーダル, ホーム警告, バッチ数制御）

### 🏗 Infrastructure
- `supabase_analytics.sql`: analytics_events + feature_flags + daily_kpi_cache テーブル
- `/api/analytics`: イベント受信API（常に200返却、UI非ブロッキング）
- `/api/admin/dashboard`: 日次KPI集計API（ADMIN_SECRET認証）
- `/api/admin/flags`: Feature Flags CRUD API

## [2026-03-06] — 表紙サーバー検証 & カード簡素化

### 🐛 Bug Fix
- AI生成ISBNの不正確さ対策: NDLサムネイルURLをサーバーサイドでHEAD検証（200確認後にのみ返却）
- NDL検証失敗時はGoogle Books APIにフォールバック
- 不正ISBN → 404の問題を根本解決

### 🎨 Design
- カードからheadline/onelinerを削除（内容重複解消）
- **labelをアイキャッチとして本タイトルより目立つ表示に**（コーラルグラデーション、15px太字）
- AIプロンプト: labelはnoteの具体的な言葉を活かした刺さる一文に（汎用要約を禁止）

## [2026-03-06] — UXオーバーホール: カルーセル & ナビゲーション

### ✨ Feature
- compassロゴを左上に常時表示（ホームに戻るリンク）
- ホームに戻る時「内容が失われます」警告モーダル表示（未登録ユーザー）
- APIを常に3冊ずつ生成に統一（3+3+3の段階的ロード）
- 「📚 4冊目以降を探しています…」の明確なインジケーター表示
- 3冊ずつシームレスにバッチ遷移（次の3冊/前の3冊）
- しおりタップで登録促進モーダル表示

### 🎨 Design
- 3冊を横スワイプカルーセル化（ブロック内はスワイプ、ブロック間はボタンナビ）
- 「この本について」をデフォルト表示（手紙は折りたたみ維持）
- カード下部にスワイプインジケーター（ドット）追加
- 固定ヘッダーにグラスモーフィズム適用

## [2026-03-06] — 表紙表示v2: NDL + 2フェーズAPI

### 🐛 Bug Fix
- Google Books API クォータ超過(429)を特定 → **NDL（国立国会図書館）のサムネイルサービスに移行**
- 表紙画像をISBNベースでクライアント側からNDLに直接リクエスト（サーバー側API呼び出し不要）
- AIプロンプトでISBN-13の記載を必須化

### ✨ Feature
- **2フェーズAPI分割**: Phase1で3冊（高速表示）→ Phase2で追加6冊（バックグラウンド）
- 「他の本を探す」押下で初めてPhase2のAI呼び出しを開始（体感速度が大幅向上）
- Phase2完了時に自動でページ2へ遷移

### 🔧 Config
- CSPにNDLドメイン（ndlsearch.ndl.go.jp）を追加
- レートリミットを6回/分に緩和（2フェーズ対応）

## [2026-03-06] — 表紙表示修正 & プログレッシブ表示

### 🐛 Bug Fix
- Google Books API サムネイル検索を4段階フォールバック戦略に強化（ISBN → intitle+inauthor → フリーテキスト → タイトルのみ）
- サムネイル未取得時にタイトル+著者名を表示するスタイリッシュなプレースホルダーに変更（汎用画像廃止）
- AIプロンプトにISBNフィールド追加で書籍特定精度向上

### ✨ Feature
- プログレッシブ表示: 最初に3冊のみ表示、「他の本を探す」で+3冊ずつ（最大9冊）
- 3冊ごとの前後ページ移動（← 前へ / 次へ →）を追加
- 全9冊表示後にページネーション（1/3）表示

### 🎨 Design
- TOPページアイコンをcompass SVGアイコンに変更（📖 絵文字廃止）
- 表紙プレースホルダーを暖色グラデーション + 背表紙ラインのブック風デザインに

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
