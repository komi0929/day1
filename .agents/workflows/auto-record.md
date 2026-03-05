---
description: コード変更後にCHANGELOGを更新しGitに自動記録する
---

// turbo-all

# Auto-Record ワークフロー

コード変更が完了したら、以下を自動実行する。

## 0. 一貫性チェック（テキスト変更を含む場合）

テキスト・文言・ブランド名に関わる変更を行った場合、`/consistency-check` を先に実行する。

## 1. CHANGELOG 更新

`CHANGELOG.md` の先頭に変更内容を追記する（カテゴリ: Feature / Bug Fix / Refactor / Design / Config / Docs / Cleanup）

## 2. ステージング

```powershell
git add -A
```

## 3. コミット

```powershell
git commit -m "[Emoji] 変更の要約"
```

絵文字プレフィクス: ✨Feature / 🐛Bug / 🎨Design / ♻️Refactor / 🗑️Cleanup / 📝Docs / 🔧Config

## 4. プッシュ

```powershell
git push origin main
```
