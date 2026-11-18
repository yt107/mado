import { Hono } from "hono";
import { csrf } from "hono/csrf";

import { auth } from "./auth";
import boards from "./routes/boards";
import me from "./routes/me";

const app = new Hono()
  .basePath("/api")
  // ログインの処理は Better Auth に任せる（/api/auth/*）。送り元の確認も Better Auth がする
  .on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw))
  // ここから下の API は、データを変えるリクエストの送り元を確かめる（CSRF 対策）。
  // Hono は登録した順に動くので、上の /api/auth/* には効かない
  .use(csrf())
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/me", me)
  .route("/boards", boards);

export type AppType = typeof app;
export default app;
