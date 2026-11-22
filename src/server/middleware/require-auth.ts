import { createMiddleware } from "hono/factory";

import { auth } from "../auth";

type Session = typeof auth.$Infer.Session;

// ログインしていなければ 401 を返して、先へ進ませない。
// ログイン中なら、ユーザーとセッションを c.var に入れて、次の処理へ渡す
export const requireAuth = createMiddleware<{
  Variables: { user: Session["user"]; session: Session["session"] };
}>(async (c, next) => {
  const result = await auth.api.getSession({
    headers: c.req.raw.headers,
    // ここでは、ログインの期限を延ばさない（延ばすのは /api/auth/get-session だけ。
    // 理由は src/lib/session.ts と同じ）
    query: { disableRefresh: true },
  });
  if (!result) {
    return c.json(
      { error: { code: "unauthorized", message: "ログインしてください" } },
      401,
    );
  }
  c.set("user", result.user);
  c.set("session", result.session);
  await next();
});
