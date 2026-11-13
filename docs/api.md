# API 一覧（Mado）

Mado の API の一覧と、API 全体の決めごと。OpenAPI は今は書かない（あとで必要になったら、コードから hono-openapi で作る）。

区切り2で作る API は、受け取る値と返す値まで書く。区切り3以降は一覧の粒度にとどめ、作るときに詳しくする。

## 前提

- API の本体は Hono（`src/server/`）。パスはすべて `/api` から始まる
- 画面からは Hono RPC（`hc`）で呼ぶ
- 入力はすべて Zod でチェックする（Hono の validator を使い、ハンドラーの中で本文を読んで確かめない）。主な返す値の形も Zod で書く
- JSON のキーは `camelCase`。DB の列は `snake_case` で、Drizzle で変換する
- 日時は ISO 8601 の文字列（UTC）。例：`"2026-11-20T01:00:00.000Z"`
- ID は、ユーザーは Better Auth が作る文字列、ボードとウィジェットなどは UUID

## ログイン状態と権限

- ログイン状態は、Better Auth のセッション（Cookie）で持つ
- ログインが必要ないのは、`/api/health` と `/api/auth/*` だけ
- 利用規約にまだ同意していないユーザーが使えるのは、`GET /api/me`、`POST /api/me/consent`、`DELETE /api/me` だけ
- 他人のデータを指定されたら 404 を返す。403 を返すと、そのデータがあることが分かってしまうため
- データを変える API（POST、PUT、PATCH、DELETE）は、Hono の CSRF ミドルウェアで、リクエストの送り元（Origin）を確かめる

## エラー

エラーの本文は、次の形にそろえる。

```json
{ "error": { "code": "validation_error", "message": "ユーザー名は1〜50文字で入力してください" } }
```

| 状態コード | `code` | 使う場面 |
|---|---|---|
| 400 | `validation_error` | 入力が不正 |
| 401 | `unauthorized` | ログインしていない |
| 403 | `terms_not_accepted` | 利用規約に同意していない |
| 403 | `reauthentication_required` | 退会の前の本人確認（Googleでの再ログイン）が必要 |
| 404 | `not_found` | 見つからない（他人のデータも含む） |
| 409 | `conflict` | 状態が合わない（ボードを2つ作ろうとした、配置が重なる など） |

## 一覧

### ログイン（Better Auth）

自分では書かず、Better Auth の handler を Hono の `/api/auth/*` につなぐ。

| メソッド | パス | 用途 | 区切り |
|---|---|---|---|
| POST | `/api/auth/sign-in/social` | Googleでログインを始める | 2 |
| GET | `/api/auth/callback/google` | Googleから戻ってくる | 2 |
| GET | `/api/auth/get-session` | 今のログイン状態 | 2 |
| POST | `/api/auth/sign-out` | ログアウト | 2 |

### 自分（初回の確認画面、マイページ）

| メソッド | パス | 用途 | 区切り |
|---|---|---|---|
| GET | `/api/me` | 自分の情報 | 2 |
| POST | `/api/me/consent` | 利用規約に同意する。ユーザー名も一緒に保存する | 2 |
| PATCH | `/api/me` | ユーザー名を変える | 5 |
| DELETE | `/api/me` | 未同意ならすぐ削除（キャンセル）。同意済みなら、再ログインから10分以内のときだけ削除（退会） | 2（キャンセル）、5（退会） |

### ボード

| メソッド | パス | 用途 | 区切り |
|---|---|---|---|
| GET | `/api/boards` | 自分のボードの一覧（MVP では0件か1件） | 2 |
| POST | `/api/boards` | テンプレートを選んで、ボードを作る。MVP では1人1つまで | 2 |
| GET | `/api/boards/:boardId` | ボードの中身を全部。表示モードも、これを定期的に読む | 2 |

### ウィジェット（編集モード）

| メソッド | パス | 用途 | 区切り |
|---|---|---|---|
| POST | `/api/boards/:boardId/widgets` | 一覧からウィジェットを置く。同じ種類がもうあれば、その表示先の配置だけ作る（前の中身と設定のまま戻る） | 3 |
| PATCH | `/api/widgets/:widgetId` | 設定（`settings`）を変える。種類ごとに Zod のスキーマを分ける | 3 |
| PUT | `/api/widgets/:widgetId/placements/:displayTarget` | 移動、サイズの変更。重なりは 409、グリッドからはみ出したら 400 | 3 |
| DELETE | `/api/widgets/:widgetId/placements/:displayTarget` | 「外す」。その表示先の配置だけ消し、中身は残す | 3 |

### ウィジェットの中身

| メソッド | パス | 用途 | 区切り |
|---|---|---|---|
| POST | `/api/widgets/:widgetId/todo-items` | ToDo を足す | 4 |
| PATCH | `/api/todo-items/:itemId` | ToDo の文言、完了、並び順を変える | 4 |
| DELETE | `/api/todo-items/:itemId` | ToDo を消す | 4 |
| PUT | `/api/widgets/:widgetId/memo` | メモの本文を保存する（500文字まで） | 4 |
| POST | `/api/widgets/:widgetId/calendar-subscriptions` | iCal の URL を登録する | 4 |
| PATCH | `/api/calendar-subscriptions/:id` | 名前や色を変える | 4 |
| DELETE | `/api/calendar-subscriptions/:id` | 登録をやめる | 4 |
| GET | `/api/widgets/:widgetId/calendar-events` | 予定を取得する（サーバーが iCal を読みに行く） | 4 |
| POST | `/api/widgets/:widgetId/news-feeds` | フィードを登録する（サイトの URL なら、フィードを探す） | 4 |
| PATCH | `/api/news-feeds/:id` | 名前や並び順を変える | 4 |
| DELETE | `/api/news-feeds/:id` | 登録をやめる | 4 |
| GET | `/api/widgets/:widgetId/news-items` | 記事を取得する | 4 |

- iCal の URL は、登録したあとは画面に返さない。非公開の URL は、それだけでカレンダーを読める鍵になるため
- 地域の検索と天気の API は、使う外部のサービスと一緒に、区切り4で決める。区切り2の初期設定は、テンプレートを選ぶだけにする

### 動作確認

| メソッド | パス | 用途 | 区切り |
|---|---|---|---|
| GET | `/api/health` | サーバーが動いているか | 1（済み） |

## 区切り2の API の詳細

### `GET /api/me`

自分の情報を返す。初回の確認画面に進ませるかは、`termsAcceptedAt` が `null` かどうかで決める。

200：

```json
{
  "id": "user_xxx",
  "name": "Taro",
  "email": "taro@example.com",
  "image": "https://lh3.googleusercontent.com/...",
  "termsAcceptedAt": null,
  "createdAt": "2026-11-20T01:00:00.000Z"
}
```

### `POST /api/me/consent`

利用規約に同意し、ユーザー名を保存する。同意した日時はサーバーが記録し、画面からは書き換えられない。

リクエスト：

```json
{ "name": "Taro", "agreeToTerms": true }
```

- `name`：前後の空白を除いて1〜50文字
- `agreeToTerms`：`true` でなければ 400

200：`GET /api/me` と同じ形（`termsAcceptedAt` に日時が入る）

- すでに同意済みなら 409

### `DELETE /api/me`

自分を削除する。`accounts`、`sessions`、ボード以下のデータも、まとめて削除される（ON DELETE CASCADE）。

- 未同意（`termsAcceptedAt` が `null`）なら、すぐに削除する。確認画面の「キャンセルしてログアウト」で使う
- 同意済みなら、今のセッションが作られてから10分以内（Googleで再ログインした直後）のときだけ削除する。それ以外は 403（`reauthentication_required`）。退会で使う（区切り5）

204：本文なし。セッションの Cookie も消す

### `GET /api/boards`

200：

```json
{
  "boards": [{ "id": "6f1c...", "name": "マイボード", "sortOrder": 0 }]
}
```

- まだボードがなければ `"boards": []`。画面はテンプレートの選択に進む

### `POST /api/boards`

テンプレートを選んで、ボードを作る。テンプレートの中身（ウィジェット、設定、6つの表示先の配置）は、コードの定数から作る。

リクエスト：

```json
{ "templateId": "basic" }
```

- `templateId`：`basic`（ベーシック）、`standby`（スタンバイ）、`family`（ファミリー）、`workdesk`（ワークデスク）、`blank`（白紙）のどれか
- ボードの名前は「マイボード」で作る

201：`GET /api/boards/:boardId` と同じ形

- すでにボードがあれば 409（MVP では1人1つまで）

### `GET /api/boards/:boardId`

ボードの中身を全部返す。編集モードと表示モードの両方で使う。

200：

```json
{
  "id": "6f1c...",
  "name": "マイボード",
  "widgets": [
    {
      "id": "a2d4...",
      "type": "clock",
      "settings": {},
      "placements": [
        { "displayTarget": "pc", "page": 1, "x": 0, "y": 0, "w": 2, "h": 2 },
        { "displayTarget": "tablet_portrait", "page": 1, "x": 0, "y": 0, "w": 3, "h": 2 }
      ]
    }
  ]
}
```

- `placements` がない表示先では、そのウィジェットは「未配置」
- `page` は1から数える（スマホ縦の2ページ目なら `2`）。`x`、`y` はマスの位置で0から数える
- `settings` の中身は種類ごとに違う。時計の設定は、区切り2で作るときに、画面設計の「時計の設定」に合わせて書き足す
- ToDo の項目やメモの本文は、区切り4でウィジェットの中に足す
