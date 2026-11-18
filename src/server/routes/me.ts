import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import * as z from "zod";

import type { auth } from "../auth";
import { db } from "../db";
import { users } from "../db/schema";
import { requireAuth } from "../middleware/require-auth";
import { zValidator } from "../validator";

// 返す値の形（docs/api.md の GET /api/me）
const meSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  termsAcceptedAt: z.date().nullable(),
  createdAt: z.date(),
});

// 自分の情報を、返す値の形にそろえる。ほかの列（updatedAt など）は返さない
const toMe = (user: typeof auth.$Infer.Session.user) =>
  meSchema.parse({
    ...user,
    image: user.image ?? null,
    termsAcceptedAt: user.termsAcceptedAt ?? null,
  });

// 利用規約に同意するときに受け取る値
const consentSchema = z.object({
  name: z
    .string({ error: "ユーザー名を入力してください" })
    .trim()
    .min(1, "ユーザー名を入力してください")
    .max(50, "ユーザー名は50文字までにしてください"),
  agreeToTerms: z.literal(true, { error: "利用規約に同意してください" }),
});

// /api/me（自分の情報）。どれもログインが必要
const me = new Hono()
  .use(requireAuth)
  // 自分の情報を返す。termsAcceptedAt が null なら、画面は確認画面へ進ませる
  .get("/", (c) => c.json(toMe(c.var.user)))
  // 利用規約に同意して、ユーザー名を保存する。同意した日時はサーバーが決める
  .post("/consent", zValidator("json", consentSchema), async (c) => {
    const { name } = c.req.valid("json");
    // まだ同意していないときだけ書き込む。2回同時に送られても、書き込めるのは1回だけ
    const [updated] = await db
      .update(users)
      .set({ name, termsAcceptedAt: new Date() })
      .where(and(eq(users.id, c.var.user.id), isNull(users.termsAcceptedAt)))
      .returning();
    if (!updated) {
      return c.json(
        { error: { code: "conflict", message: "すでに同意しています" } },
        409,
      );
    }
    return c.json(toMe(updated), 200);
  });

export default me;
