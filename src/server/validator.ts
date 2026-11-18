import { zValidator as zv } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type * as z from "zod";

// Zod で入力をチェックする。だめなら、docs/api.md のエラーの形で 400 を返す。
// @hono/zod-validator の README にある、包んで使う書き方
export const zValidator = <
  T extends z.ZodType,
  Target extends keyof ValidationTargets,
>(
  target: Target,
  schema: T,
) =>
  zv(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "validation_error",
            message:
              result.error.issues[0]?.message ?? "入力が正しくありません",
          },
        },
        400,
      );
    }
  });
