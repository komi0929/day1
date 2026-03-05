---
description: リリース前に全チェック項目を自動検証する
---

// turbo-all

# Pre-Release ワークフロー

リリース前（デプロイ前、完了報告前）に、以下のチェックをすべて自動実行する。
**ひとつでも NG があれば、報告前に自分で修正すること。**

## 1. ビルド検証

```powershell
npx next build --webpack
```

Exit code 0 でなければ、エラーを修正して再実行。

## 2. 一貫性チェック（`/consistency-check` を実行）

`.agents/workflows/consistency-check.md` の手順をすべて実行する。

## 3. デッドコード検出

以下のファイルが `src/app/` 配下のどこからも import されていない場合、削除する：
- `src/lib/` 配下のファイル（`supabase.ts`, `auth-context.tsx`, `security.ts` 等）
- プロジェクトルートの `.sql` ファイル

検出方法:
```powershell
# 各 lib ファイルが実際に使われているか検索
Select-String -Path "src/app/**/*.tsx","src/app/**/*.ts" -Pattern "from.*['\"]\.\./lib/" -Recurse
```

## 4. 環境変数チェック

`process.env` で参照されている変数をリストアップし、以下を確認する：
- 各変数にフォールバック値またはエラーハンドリングがあること
- 不要な環境変数（使われていないコードから参照される変数）がないこと

## 5. メタ情報整合性

- `layout.tsx` の title/description
- `manifest.json` の name/description
- `robots.txt` の Sitemap URL
- OGP情報
すべてが同じブランド名・コンセプトで統一されていること。

## 6. 法的文書チェック

- `terms/page.tsx` と `privacy/page.tsx` のサービス名がプロジェクト名と一致すること

## 7. CHANGELOG 更新

上記チェックで修正が発生した場合、`CHANGELOG.md` に追記する。

## ⚠️ 重要

- **このチェックをすべて通過するまで、ユーザーに報告してはならない**
- チェックで見つかった問題は、質問せずに自分で修正する
- 修正後は再度ビルド検証を行う
