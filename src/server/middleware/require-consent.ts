import { createMiddleware } from "hono/factory";

import type { auth } from "../auth";

type User = (typeof auth.$Infer.Session)["user"];

// 利用規約に同意していなければ 403 を返して、先へ進ませない（docs/api.md）。
// requireAuth のあとに使う（c.var.user を読むため）
export const requireConsent = createMiddleware<{
  Variables: { user: User };
}>(async (c, next) => {
  if (!c.var.user.termsAcceptedAt) {
    return c.json(
      {
        error: {
          code: "terms_not_accepted",
          message: "利用規約に同意してください",
        },
      },
      403,
    );
  }
  await next();
});
