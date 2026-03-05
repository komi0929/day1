---
description: プロジェクト全体の名称・テキスト整合性を自動検証する
---

// turbo-all

# Consistency Check ワークフロー

テキスト変更・リブランド・フェーズ変更後に、以下をすべて自動実行する。

## 1. 旧名称の残存チェック

プロジェクト内のすべてのソースファイルから、旧名称やレガシー表現が残っていないか検索する。

```powershell
# 旧ブランド名の残存チェック（該当があれば修正する）
Select-String -Path "src/**/*.tsx","src/**/*.ts","public/*.json","public/*.txt" -Pattern "あなたのための1冊|BookFinder|day1|Compass(?!\.)|notememo(?!-)" -Recurse
```

※ 現在の正式名称は「compass」（小文字）。それ以外のバリエーションが見つかったら修正する。

## 2. メタ情報の統一チェック

以下のファイル間でブランド名・説明文が統一されているか確認する：

| ファイル | チェック項目 |
|---------|-------------|
| `src/app/layout.tsx` | title, description, OGP |
| `public/manifest.json` | name, short_name, description |
| `public/robots.txt` | Sitemap URL のドメイン |
| `src/app/terms/page.tsx` | サービス名 |
| `src/app/privacy/page.tsx` | サービス名 |

## 3. システム用語の排除チェック

ユーザー向けテキスト（UI表示文字列）に以下の機械的用語が含まれていないか確認する：

```powershell
# UI向けテキストにシステム用語が残っていないかチェック
Select-String -Path "src/app/page.tsx","src/app/error.tsx","src/app/not-found.tsx" -Pattern "AI|推論|スクレイピング|システムエラー|ローディング|取得失敗|解析|リコメンド"
```

※ LLMプロンプト内（route.ts 内の SYSTEM_PROMPT / userPrompt）は対象外。
※ ただし LLM プロンプト内でも「AIとして」「推論の結果」等のAI自称表現は禁止。

## 4. エラーメッセージのトーンチェック

エラーメッセージが温かい表現になっているか確認する。以下のパターンが見つかったら修正する：

```powershell
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "エラーが発生|失敗しました|設定エラー|入力してください。$" -Recurse
```

## 5. 不整合が見つかった場合

- **ユーザーに聞かず、自分で修正する**
- 修正後にビルド検証を再実行する
- `CHANGELOG.md` に修正内容を追記する
