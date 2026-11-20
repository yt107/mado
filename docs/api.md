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
| 409 | `conflict` | 状態が合わない（ボードを2つ作ろうとした、配置が重なる、同じフィードを2回登録した など） |
| 422 | `fetch_failed` | 外の URL（iCal、RSS）を読めなかった、または iCal・RSS の形ではなかった（登録のとき） |

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
- 天気と地域の検索は、Mado の API を通さず、画面（端末のブラウザ）から Open-Meteo を直接呼ぶ（下の「天気」を参照）

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
{
  "templateId": "basic",
  "location": { "name": "渋谷", "region": "東京都 渋谷区", "latitude": 35.6589, "longitude": 139.70665 }
}
```

- `templateId`：`basic`（ベーシック）、`standby`（スタンバイ）、`family`（ファミリー）、`workdesk`（ワークデスク）、`blank`（白紙）のどれか
- `location`：初回の設定で選んだ天気の地域（なくてもよい）。テンプレートに天気があれば、天気の設定の `location` に入れる
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
- ウィジェットは種類の順（時計、天気、カレンダー、ToDo、メモ、カウントダウン、ニュース）に並べる
- 他人のボードなら 404。ID が UUID の形でなければ 400
- `settings` の中身は種類ごとに違う（下の「時計の設定」と、区切り4の「ToDo・メモ・カウントダウンの設定」「天気・カレンダー・ニュースの設定」）
- ToDo のウィジェットには `todoItems`（項目の配列。並び順）、メモのウィジェットには `memo`（`{ body, updatedAt }`。まだ書いていなければ `null`）が付く
- カレンダーのウィジェットには `calendarSubscriptions`（購読先の配列。URL は含めない）、ニュースのウィジェットには `newsFeeds`（フィードの配列。並び順）が付く

#### 時計の設定（`type: "clock"` の `settings`）

画面設計の「時計の設定」に合わせる。保存していない項目は、右の初期値として読む（`src/lib/widgets/clock.ts` の Zod スキーマ）。

| キー | 値 | 初期値 |
|---|---|---|
| `hourCycle` | `"24h"`（24時間）、`"12h"`（午前・午後） | `"24h"` |
| `showSeconds` | 秒を出すか | `true` |
| `showDate` | 日付を出すか | `true` |
| `dateFormat` | `"monthDayWeekday"`（11月6日 金曜日）、`"yearMonthDayWeekday"`（2026年11月6日 金曜日）、`"numeric"`（2026/11/06(金)） | `"monthDayWeekday"` |
| `textStyle` | `"thin"`（細字）、`"regular"`（標準）、`"bold"`（太字） | `"thin"` |
| `city` | 基準のタイムゾーンの都市の ID（`"tokyo"` など）。右上に名前を出す | `"tokyo"` |
| `worldClocks` | 世界時計の都市の ID の配列（4つまで） | `[]` |

- 都市は、決まった一覧（`CITIES`）から選ぶ。保存するのは ID だけで、名前とタイムゾーンはコードから引く

## 区切り3の API の詳細（編集モード）

どれも、ウィジェット → ボード → ユーザー とたどって持ち主を確かめる。他人のボードやウィジェットなら 404。同じボードへの編集は、ボードの行をロックして1つずつ進める（重なりの確認がずれないように）。

### `POST /api/boards/:boardId/widgets`

一覧からウィジェットを置く。

リクエスト：

```json
{ "type": "todo", "displayTarget": "pc", "page": 1, "x": 3, "y": 0, "w": 1, "h": 1 }
```

201：ウィジェット（`GET /api/boards/:boardId` の `widgets` の1つと同じ形）

- その種類がまだボードになければ、ウィジェットを作る（設定は初期値）
- その種類がもうあれば、その表示先の配置だけ作る（前の中身と設定のまま戻る）
- その表示先にもう置いてあれば 409（「この表示先には、もう置いてあります」）
- ほかと重なれば 409、グリッドからはみ出せば 400

### `PATCH /api/widgets/:widgetId`

設定を変える。

リクエスト：`{ "settings": { ... } }`（設定の全部。足りない項目は初期値で埋めて保存する）

200：ウィジェット

- 種類ごとの Zod のスキーマで確かめる。合わなければ 400
- まだ設定を作っていない種類（区切り4で作るもの）は 400

### `PUT /api/widgets/:widgetId/placements/:displayTarget`

移動とサイズの変更。

リクエスト：`{ "page": 1, "x": 0, "y": 0, "w": 2, "h": 2 }`

200：配置（`{ "displayTarget": "pc", "page": 1, "x": 0, "y": 0, "w": 2, "h": 2 }`）

- 自分自身とは重なってよい（その場で大きさを変えるとき）
- ほかと重なれば 409、グリッドからはみ出せば 400（スマホ縦は2ページまで）
- その表示先にまだ置いていなければ、新しく置く

### `DELETE /api/widgets/:widgetId/placements/:displayTarget`

「外す」。その表示先の配置だけ消す。ウィジェットとほかの表示先の配置、中身は残る。

204：本文なし

## 区切り4の API の詳細（ToDo・メモ・カウントダウン）

どれも、ウィジェット → ボード → ユーザー とたどって持ち主を確かめ、ウィジェットの種類も確かめる。他人のものなら 404、種類が合わなければ 400。

### `POST /api/widgets/:widgetId/todo-items`

ToDo の項目を、いちばん下に足す。

リクエスト：`{ "title": "請求書を支払う" }`（前後の空白を除いて1〜100文字）

201：`{ "id": "…", "title": "請求書を支払う", "isDone": false, "sortOrder": 0 }`

- 1つの ToDo に入れられる項目は50件まで。それより多いと 400

### `PATCH /api/todo-items/:itemId`

項目の文言・完了・並び順を変える。変えるものだけを送る。

リクエスト：`{ "title": "…" }`、`{ "isDone": true }`、`{ "sortOrder": 0 }` など

200：項目

- `sortOrder` は「何番目（0から数える）に動かすか」。ほかの項目の並び順も 0, 1, 2… に振り直す
- 表示モードのチェックも、これを使う
- 何も送らなければ 400

### `DELETE /api/todo-items/:itemId`

204：本文なし

### `PUT /api/widgets/:widgetId/memo`

メモの本文を保存する（まだなければ作る）。

リクエスト：`{ "body": "買い物：牛乳、卵" }`（500文字まで）

200：`{ "body": "買い物：牛乳、卵", "updatedAt": "2026-11-19T01:00:00.000Z" }`

### ToDo・メモ・カウントダウンの設定（`PATCH /api/widgets/:widgetId` の `settings`）

**ToDo（`type: "todo"`）**

| キー | 値 | 初期値 |
|---|---|---|
| `showCompleted` | 完了した項目も出すか | `true` |
| `completedToBottom` | 完了した項目を下にまとめるか | `false` |

**メモ（`type: "memo"`）**

| キー | 値 | 初期値 |
|---|---|---|
| `fontSize` | `"small"`、`"medium"`、`"large"` | `"medium"` |
| `color` | `"yellow"`、`"pink"`、`"blue"`、`"green"`、`"dark"` | `"yellow"` |

**カウントダウン（`type: "countdown"`）**

| キー | 値 | 初期値 |
|---|---|---|
| `title` | イベント名（30文字まで）。見出しは「◯◯まで」 | `""` |
| `date` | イベントの日付（`"YYYY-MM-DD"`。時刻のないカレンダーの日） | `null` |
| `suffix` | 日付のあとに出す言葉（10文字まで。「出発」など） | `""` |
| `unit` | `"days"`（日数）、`"daysHours"`（日数と時間） | `"days"` |
| `showProgress` | 進み具合のバーを出すか | `true` |
| `startDate` | 進み具合のバーの始まり（日付を設定した日。画面が入れる） | `null` |

- 残りの日数は、画面（端末の時刻）で数える。当日は「今日」、過ぎたら「終了」と出す

## 区切り4の API の詳細（天気・カレンダー・ニュース）

### 外の URL を読むときの決まり（SSRF 対策）

カレンダー（iCal）とニュース（RSS・Atom）は、利用者が入力した URL をサーバーが読む。サーバーの内側のネットワークを読まれないように、`src/server/net/safe-fetch.ts` で次のことを守る。

- `https://` で、ポートが 443 のものだけ。`webcal://` は `https://` として読む。URL にユーザー名・パスワードや IP アドレスを書いたもの、`localhost`・`.internal`・`.local` などの名前は断る
- 名前を DNS で引き（`node:dns` の `resolve4` / `resolve6`）、内側のアドレス（127.0.0.0/8、10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、169.254.0.0/16 のメタデータサーバー、IPv6 の `::1`・`fc00::/7`・`fe80::/10` など）が1つでもあれば断る
- 転送（リダイレクト）は自動で追わず、1回ごとに同じ確認をする（3回まで）
- 10秒で打ち切る。大きさは iCal が 5MB、RSS が 2MB まで
- DNS を確かめたあとに答えを変えられても（DNS リバインディング）、https なので、相手が正しい証明書を出せずにつながらない

### 天気（Open-Meteo）

天気と地域の検索は、Mado の API を通さず、画面から [Open-Meteo](https://open-meteo.com/) を直接呼ぶ（`src/lib/widgets/weather.ts`）。

- Open-Meteo は、無料で使える回数（1日1万回）を IP アドレスごとに数える。ほかの利用者と IP を共有するサーバー（Cloud Run）から呼ぶと、上限に早く当たるため、端末ごとの IP で呼ぶ
- 予報：`https://api.open-meteo.com/v1/forecast`。座標は小数2桁（約1km）に丸めて送る
- 地域の検索：`https://geocoding-api.open-meteo.com/v1/search`。日本語の地名は、入力のほかに「市」を付けた形・「市・区・町・村」を外した形も一緒に探す。都道府県の名前（「大阪府」）はその名前の市（「大阪市」）で、「東京」は「東京都」で探す（Open-Meteo には都道府県の名前では載っていないため）
- データは CC BY 4.0。天気の設定パネルに出典を出す。お金をとらない使い方（広告や有料会員のないアプリ）なので、無料の範囲で使える

### `POST /api/widgets/:widgetId/calendar-subscriptions`

iCal の URL を登録する。一度読んでみて、iCal として読めたものだけを登録する。

リクエスト：`{ "url": "https://calendar.google.com/calendar/ical/…/private-…/basic.ics" }`

201：

```json
{ "id": "…", "name": "仕事", "color": "blue", "lastFetchedAt": "2026-11-19T01:28:00.000Z", "lastError": null }
```

- 名前は iCal の `X-WR-CALNAME`（なければ「カレンダー」）。色は、まだ使っていない色を順に選ぶ
- URL は AES-256-GCM で暗号化して `url_encrypted` に保存する（`src/server/encryption.ts`。鍵は環境変数 `ENCRYPTION_KEY`）。画面には返さない
- 1つのカレンダーのウィジェットに10個まで。それより多いと 400
- URL の形が正しくない・内側の URL なら 400、読めない・iCal でなければ 422（`fetch_failed`）

### `PATCH /api/calendar-subscriptions/:subscriptionId`

名前と色を変える。リクエスト：`{ "name": "会社" }`、`{ "color": "purple" }` など

- `name` は1〜50文字。`color` は `blue`・`green`・`red`・`purple`・`orange`・`teal`・`pink`・`yellow`

200：購読先

### `DELETE /api/calendar-subscriptions/:subscriptionId`

204：本文なし

### `GET /api/widgets/:widgetId/calendar-events?from=2026-11-01&to=2026-12-05`

登録したカレンダーを全部読み、期間の予定を返す。`from` と `to` は端末の日付（`to` の日も含む。62日まで）。

200：

```json
{
  "subscriptions": [{ "id": "…", "name": "仕事", "color": "blue", "lastFetchedAt": "…", "lastError": null }],
  "events": [
    { "id": "…", "subscriptionId": "…", "title": "チーム定例", "start": "2026-11-06T01:00:00.000Z", "end": "2026-11-06T02:00:00.000Z", "allDay": false },
    { "id": "…", "subscriptionId": "…", "title": "燃えるゴミの日", "start": "2026-11-07", "end": "2026-11-08", "allDay": true }
  ]
}
```

- 繰り返しの予定（毎週など）は1回ずつに展開する。除いた日（EXDATE）や、その回だけの変更（RECURRENCE-ID）、取り消し（STATUS:CANCELLED）も反映する
- 終日の予定は `"YYYY-MM-DD"`（`end` はその次の日）、ほかは ISO 8601（UTC）。今日・明日のどれに入るかは画面（端末の時刻）で決める
- 端末の時間帯がどこでも入るよう、期間の前後に1日ずつ広げて返す
- 読めなかったカレンダーは `lastError` に理由を残し、ほかのカレンダーの予定だけを返す
- 予定は DB に保存しない（docs/er.md の「DBに持たないもの」）

### `POST /api/widgets/:widgetId/news-feeds`

フィードを登録する。サイトの URL なら、ページの `<link rel="alternate" type="application/rss+xml">`（または atom+xml）からフィードを探す。

リクエスト：`{ "url": "https://zenn.dev/" }`

201：

```json
{ "id": "…", "title": "Zennのトレンド", "feedUrl": "https://zenn.dev/feed", "sortOrder": 0, "lastFetchedAt": "…", "lastError": null }
```

- 名前はフィードのタイトル（なければサイトの名前）。いちばん下に足す
- 1つのニュースのウィジェットに10個まで（400）。同じフィードは2回登録できない（409）
- フィードが見つからない・読めなければ 422（`fetch_failed`）

### `PATCH /api/news-feeds/:feedId`

名前と並び順を変える。リクエスト：`{ "title": "…" }`、`{ "sortOrder": 0 }`

- `sortOrder` は「何番目（0から数える）に動かすか」。ほかのフィードも 0, 1, 2… に振り直す

200：フィード

### `DELETE /api/news-feeds/:feedId`

204：本文なし

### `GET /api/widgets/:widgetId/news-items`

登録したフィードを全部読み、記事を新しい順に返す（全部で100件まで。1つのフィードからは20件まで）。

200：

```json
{
  "feeds": [{ "id": "…", "title": "Zennのトレンド", "feedUrl": "…", "sortOrder": 0, "lastFetchedAt": "…", "lastError": null }],
  "items": [
    { "id": "…", "feedId": "…", "title": "…", "link": "https://zenn.dev/…", "publishedAt": "2026-11-19T07:28:27.000Z", "image": null, "summary": "…" }
  ]
}
```

- `image` は、フィードに書かれた画像（`enclosure`、`media:thumbnail` など）。https のものだけ
- 読めなかったフィードは `lastError` に理由を残す
- 記事は DB に保存しない

### 天気・カレンダー・ニュースの設定（`PATCH /api/widgets/:widgetId` の `settings`）

**天気（`type: "weather"`）**

| キー | 値 | 初期値 |
|---|---|---|
| `location` | `{ name, region, latitude, longitude }`（選んだ地域） | `null` |
| `showHourly` | 時間ごとの予報 | `true` |
| `showDaily` | 週間予報（3日間） | `true` |
| `showHighLow` | 最高・最低気温 | `true` |
| `showPrecipitation` | 降水確率 | `false` |
| `unit` | `"celsius"`、`"fahrenheit"` | `"celsius"` |
| `background` | `"auto"`（天気に連動）、`"dark"`、`"light"`、`"transparent"` | `"auto"` |
| `refreshMinutes` | `15`、`30`、`60` | `30` |

**カレンダー（`type: "calendar"`）**

| キー | 値 | 初期値 |
|---|---|---|
| `showMonth` | 月表示 | `true` |
| `showToday` | 今日の予定 | `true` |
| `showTomorrow` | 明日の予定 | `true` |
| `weekStart` | `"sunday"`、`"monday"` | `"sunday"` |
| `refreshMinutes` | `15`、`30`、`60` | `30` |

**ニュース（`type: "news"`）**

| キー | 値 | 初期値 |
|---|---|---|
| `count` | `"auto"`（大きさに合わせる）、`"3"`、`"5"`、`"10"` | `"auto"` |
| `showImages` | 画像を出す（2×2 以上） | `true` |
| `autoRotate` | 見出しを10秒ごとに送る（1×1） | `true` |
| `dedupe` | 同じ記事（同じリンクか見出し）をまとめる | `true` |
| `refreshMinutes` | `15`、`30`、`60` | `15` |
