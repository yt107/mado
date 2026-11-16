import { Hono } from "hono";

import { auth } from "./auth";

const app = new Hono()
  .basePath("/api")
  // ログインの処理は Better Auth に任せる（/api/auth/*）
  .on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw))
  .get("/health", (c) => c.json({ status: "ok" }));

export type AppType = typeof app;
export default app;
