---
description: ブラウザでの本番確認時のURL規約
---

# ブラウザ確認ルール

本番環境の確認は **必ず** 以下のURLを使用すること：

```
https://day1.hitokoto.tech
```

## 禁止事項
- `localhost:3000` での本番確認は行わない（ローカル開発でのみ使用可）
- Vercel自動生成URL（`*.vercel.app`）は使わない

## ページ別URL
| ページ | URL |
|--------|-----|
| ログイン | https://day1.hitokoto.tech/login |
| ダッシュボード | https://day1.hitokoto.tech/dashboard |
| オンボーディング | https://day1.hitokoto.tech/onboarding |
| 学習 | https://day1.hitokoto.tech/learn |
| 完了 | https://day1.hitokoto.tech/complete |
| 履歴 | https://day1.hitokoto.tech/history |
