# Changelog

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
