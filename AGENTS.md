<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mado

好きなウィジェットを並べて、タブレットやサブディスプレイを「情報の窓」にする Web アプリ。1人で開発している。

## 技術構成

- Next.js 16（App Router、`src/` あり、Turbopack、Cache Components）、React 19、TypeScript、Tailwind CSS 4
- API は Hono。本体は `src/server/app.ts`、Next.js とは `src/app/api/[[...route]]/route.ts` でつなぐ
- テストは Vitest（`__tests__/`）。API は `app.request()` を使い、サーバーを起動せずにテストする
- デプロイ先は Google Cloud Run（Docker、`output: "standalone"`）。`main` に push すると、GitHub Actions が CI のあとに自動でデプロイする
- パッケージマネージャーは npm

## コマンド

- `npm run dev`：開発用サーバー
- `npm run build`：本番用のビルド
- 変更したら、`npm run lint`、`npm run typecheck`、`npm run format:check`、`npm test -- --run` がすべて通ることを確かめる（CI と同じチェック）

## 方針

- 標準的な構成を優先する。Next.js や各ツールの公式の推奨に合わせ、外れるときは理由を説明する
- 新しいパッケージを入れる前や、大きな変更をする前は、理由を説明して確認をとる
- Cloudflare Workers も試す可能性があるため、動く書き方にする。Node.js 専用の機能（`fs` など）やネイティブのモジュールを使わず、サーバーのメモリに状態を持たない
- Hono のルートは `.get()` などをつなげて書く（Hono RPC の型のため）
- API の入力チェックは Zod（Hono の validator）で行う
- TypeScript は `strict` と `noUncheckedIndexedAccess` を有効にしている。`any` を使わない

## 設計資料

- データ構造とルール：`docs/er.md`
- 画面設計：`docs/personal_dashboard.pen`（Pencil の MCP ツールだけで読み書きする）

## 守ること

- 秘密の値（`.env`、鍵、トークン）をコミットしない
- コミットのメッセージは Conventional Commits（`feat:`、`fix:`、`chore:` など）で、説明は日本語
- GCP の権限、Cloud Run の設定、GitHub の設定は、勝手に変えない
- main には直接 push しない。作業ブランチ（`feat/`、`fix/`、`docs/`、`chore/`）からプルリクエストを作り、CI が通ってから Squash でマージする
