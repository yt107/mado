import { Hono } from "hono";

const app = new Hono()
  .basePath("/api")
  .get("/health", (c) => c.json({ status: "ok" }));

export type AppType = typeof app;
export default app;
