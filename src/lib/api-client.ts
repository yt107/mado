import { hc } from "hono/client";

import type { AppType } from "@/server/app";

// 画面から Mado の API（Hono）を呼ぶためのクライアント（Hono RPC）。
// 受け取る値と返す値の型が、API のコードから自動でつく。画面と API は同じドメインなので、"/" から呼ぶ
export const api = hc<AppType>("/").api;
