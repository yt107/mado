# Mado

時計、天気、カレンダーなどの好きなウィジェットを並べて、タブレットやサブディスプレイを「情報の窓」にする Web アプリです。

## 設計資料

- [ER 図とデータのルール](docs/er.md)
- 画面設計：[docs/personal_dashboard.pen](docs/personal_dashboard.pen)（[Pencil](https://pen.dev/) で作成）

## 開発の始め方

必要なもの：Node.js 24（`.nvmrc` に記載）、npm

```bash
npm install
npm run dev
```

http://localhost:3000 で開けます。

## コマンド

| コマンド               | 内容                         |
| ---------------------- | ---------------------------- |
| `npm run dev`          | 開発用サーバーを起動する     |
| `npm run build`        | 本番用にビルドする           |
| `npm run lint`         | ESLint でチェックする        |
| `npm run typecheck`    | 型をチェックする             |
| `npm run format`       | Prettier で整形する          |
| `npm run format:check` | 整形が必要なファイルを調べる |
| `npm test`             | テストを実行する（Vitest）   |
