// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import app from "@/server/app";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

// DB を、テスト用の DB（PGlite）に差し替える。Better Auth も同じ DB を使う
vi.mock("@/server/db", async () => {
  const { createTestDb } = await import("../helpers/test-db");
  return { db: await createTestDb() };
});

// テストの前に、ユーザーを1人作っておく（まだ同意していない）
let user: typeof users.$inferSelect;
beforeEach(async () => {
  const [created] = await db
    .insert(users)
    .values({ id: "user_1", name: "Taro Google", email: "taro@example.com" })
    .returning();
  user = created!;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete(users);
});

// ログインした状態にする。Better Auth がセッションを確かめる処理を、DB のユーザーを返すものに差し替える
async function login() {
  const current = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });
  const now = new Date();
  vi.spyOn(auth.api, "getSession").mockResolvedValue({
    user: current!,
    session: {
      id: "session_1",
      userId: user.id,
      token: "token",
      expiresAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });
}

function postConsent(body: unknown) {
  return app.request("/api/me/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/me", () => {
  test("ログインしていなければ 401", async () => {
    const res = await app.request("/api/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "unauthorized", message: "ログインしてください" },
    });
  });

  test("ログイン中なら自分の情報", async () => {
    await login();
    const res = await app.request("/api/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "user_1",
      name: "Taro Google",
      email: "taro@example.com",
      image: null,
      termsAcceptedAt: null,
      createdAt: user.createdAt.toISOString(),
    });
  });
});

describe("POST /api/me/consent", () => {
  test("同意すると、ユーザー名と同意した日時を保存する", async () => {
    await login();
    const res = await postConsent({ name: "  たろう  ", agreeToTerms: true });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: "user_1", name: "たろう" });
    expect(body.termsAcceptedAt).toEqual(expect.any(String));

    const saved = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(saved?.name).toBe("たろう");
    expect(saved?.termsAcceptedAt).toBeInstanceOf(Date);
  });

  test("同意済みなら 409", async () => {
    await db
      .update(users)
      .set({ termsAcceptedAt: new Date() })
      .where(eq(users.id, user.id));
    await login();
    const res = await postConsent({ name: "たろう", agreeToTerms: true });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "conflict", message: "すでに同意しています" },
    });
  });

  test.each([
    [{ name: "   ", agreeToTerms: true }, "ユーザー名を入力してください"],
    [
      { name: "あ".repeat(51), agreeToTerms: true },
      "ユーザー名は50文字までにしてください",
    ],
    [{ agreeToTerms: true }, "ユーザー名を入力してください"],
    [{ name: "たろう", agreeToTerms: false }, "利用規約に同意してください"],
    [{ name: "たろう" }, "利用規約に同意してください"],
  ])("入力が正しくなければ 400（%o）", async (body, message) => {
    await login();
    const res = await postConsent(body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "validation_error", message },
    });
    // DB は変わらない
    const saved = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(saved?.termsAcceptedAt).toBeNull();
  });

  test("50文字ちょうどなら保存できる", async () => {
    await login();
    const res = await postConsent({
      name: "あ".repeat(50),
      agreeToTerms: true,
    });
    expect(res.status).toBe(200);
  });

  test("ログインしていなければ 401", async () => {
    const res = await postConsent({ name: "たろう", agreeToTerms: true });
    expect(res.status).toBe(401);
  });

  test("ほかのサイトのフォームから送られたら 403（CSRF 対策）", async () => {
    await login();
    const res = await app.request("/api/me/consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.example",
      },
      body: "name=evil&agreeToTerms=true",
    });
    expect(res.status).toBe(403);
  });
});
