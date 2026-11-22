import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import * as z from "zod";

import { auth } from "../auth";
import { db } from "../db";
import { users } from "../db/schema";
import { requireAuth } from "../middleware/require-auth";
import { requireConsent } from "../middleware/require-consent";
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

// 退会の前に再ログインしてから、消せるまでの時間（10分）
const REAUTH_WINDOW_MS = 10 * 60 * 1000;

// ユーザー名（前後の空白を除いて1〜50文字）。同意のときと、マイページで変えるときに使う
const nameSchema = z
  .string({ error: "ユーザー名を入力してください" })
  .trim()
  .min(1, "ユーザー名を入力してください")
  .max(50, "ユーザー名は50文字までにしてください");

// 利用規約に同意するときに受け取る値
const consentSchema = z.object({
  name: nameSchema,
  agreeToTerms: z.literal(true, { error: "利用規約に同意してください" }),
});

// マイページで変えられる値（今はユーザー名だけ）
const updateMeSchema = z.object({ name: nameSchema });

// /api/me（自分の情報）。どれもログインが必要
const me = new Hono()
  .use(requireAuth)
  // 自分の情報を返す。termsAcceptedAt が null なら、画面は確認画面へ進ませる
  .get("/", (c) => c.json(toMe(c.var.user)))
  // ユーザー名を変える（マイページ）。利用規約に同意したユーザーだけ
  .patch("/", requireConsent, zValidator("json", updateMeSchema), async (c) => {
    const { name } = c.req.valid("json");
    const [updated] = await db
      .update(users)
      .set({ name })
      .where(eq(users.id, c.var.user.id))
      .returning();
    // セッションを確かめたあとに、ほかの端末で退会していた
    if (!updated) {
      return c.json(
        { error: { code: "unauthorized", message: "ログインしてください" } },
        401,
      );
    }
    return c.json(toMe(updated), 200);
  })
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
  })
  // 自分を削除する。accounts、sessions、ボード以下も、まとめて消える（ON DELETE CASCADE）
  .delete("/", async (c) => {
    const { user, session } = c.var;
    // 同意済みなら退会。Google で再ログインしてから10分以内のときだけ消せる（本人の確認）
    if (
      user.termsAcceptedAt &&
      Date.now() - session.createdAt.getTime() > REAUTH_WINDOW_MS
    ) {
      return c.json(
        {
          error: {
            code: "reauthentication_required",
            message: "もう一度ログインしてから、やり直してください",
          },
        },
        403,
      );
    }
    await db.delete(users).where(eq(users.id, user.id));
    // セッションの Cookie を消す。Better Auth のログアウトを使い、返ってきた Set-Cookie を引き継ぐ
    const { headers } = await auth.api.signOut({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie()) {
      c.header("Set-Cookie", cookie, { append: true });
    }
    return c.body(null, 204);
  });

export default me;
