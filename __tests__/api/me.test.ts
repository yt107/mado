// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import app from "@/server/app";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";

import { loginAs } from "../helpers/test-auth";

// DB を、テスト用の DB（PGlite）に差し替える。Better Auth も同じ DB を使う
vi.mock("@/server/db", async () => {
  const { createTestDb } = await import("../helpers/test-db");
  return { db: await createTestDb() };
});

const userId = "user_1";

// テストの前に、ユーザーを1人作っておく（まだ同意していない）
let createdAt: Date;
beforeEach(async () => {
  const [created] = await db
    .insert(users)
    .values({ id: userId, name: "Taro Google", email: "taro@example.com" })
    .returning();
  createdAt = created!.createdAt;
});

afterEach(async () => {
  await db.delete(users);
});

async function findUser() {
  return db.query.users.findFirst({ where: eq(users.id, userId) });
}

async function acceptTerms() {
  await db
    .update(users)
    .set({ termsAcceptedAt: new Date() })
    .where(eq(users.id, userId));
}

function postConsent(body: unknown, headers?: Headers) {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  return app.request("/api/me/consent", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

function deleteMe(headers?: Headers) {
  const h = new Headers(headers);
  // ブラウザが同じサイトから送るときと同じヘッダー（CSRF 対策の確認を通る）
  h.set("Origin", "http://localhost");
  return app.request("/api/me", { method: "DELETE", headers: h });
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
    const res = await app.request("/api/me", {
      headers: await loginAs(userId),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: userId,
      name: "Taro Google",
      email: "taro@example.com",
      image: null,
      termsAcceptedAt: null,
      createdAt: createdAt.toISOString(),
    });
  });
});

describe("POST /api/me/consent", () => {
  test("同意すると、ユーザー名と同意した日時を保存する", async () => {
    const res = await postConsent(
      { name: "  たろう  ", agreeToTerms: true },
      await loginAs(userId),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: userId, name: "たろう" });
    expect(body.termsAcceptedAt).toEqual(expect.any(String));

    const saved = await findUser();
    expect(saved?.name).toBe("たろう");
    expect(saved?.termsAcceptedAt).toBeInstanceOf(Date);
  });

  test("同意済みなら 409", async () => {
    await acceptTerms();
    const res = await postConsent(
      { name: "たろう", agreeToTerms: true },
      await loginAs(userId),
    );

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
    const res = await postConsent(body, await loginAs(userId));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "validation_error", message },
    });
    // DB は変わらない
    expect((await findUser())?.termsAcceptedAt).toBeNull();
  });

  test("50文字ちょうどなら保存できる", async () => {
    const res = await postConsent(
      { name: "あ".repeat(50), agreeToTerms: true },
      await loginAs(userId),
    );
    expect(res.status).toBe(200);
  });

  test("ログインしていなければ 401", async () => {
    const res = await postConsent({ name: "たろう", agreeToTerms: true });
    expect(res.status).toBe(401);
  });

  test("ほかのサイトのフォームから送られたら 403（CSRF 対策）", async () => {
    const headers = await loginAs(userId);
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    headers.set("Origin", "https://evil.example");
    const res = await app.request("/api/me/consent", {
      method: "POST",
      headers,
      body: "name=evil&agreeToTerms=true",
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/me", () => {
  test("同意していなければ、すぐに削除して、Cookie も消す", async () => {
    const headers = await loginAs(userId);
    const res = await deleteMe(headers);

    expect(res.status).toBe(204);
    expect(await findUser()).toBeUndefined();
    // セッションもまとめて消える
    expect(
      await db.query.sessions.findMany({ where: eq(sessions.userId, userId) }),
    ).toEqual([]);
    // セッションの Cookie を消す指示（Max-Age=0）が返る
    expect(res.headers.get("Set-Cookie")).toMatch(
      /better-auth\.session_token=;.*Max-Age=0/,
    );
    // 同じ Cookie では、もう使えない
    const after = await app.request("/api/me", { headers });
    expect(after.status).toBe(401);
  });

  test("同意済みでも、ログインしてから10分以内なら削除できる（退会）", async () => {
    await acceptTerms();
    const res = await deleteMe(await loginAs(userId));

    expect(res.status).toBe(204);
    expect(await findUser()).toBeUndefined();
  });

  test("同意済みで、ログインしてから10分を過ぎていたら 403", async () => {
    await acceptTerms();
    const headers = await loginAs(userId);
    // セッションを11分前に作ったことにする
    await db
      .update(sessions)
      .set({ createdAt: new Date(Date.now() - 11 * 60 * 1000) })
      .where(eq(sessions.userId, userId));

    const res = await deleteMe(headers);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        code: "reauthentication_required",
        message: "もう一度ログインしてから、やり直してください",
      },
    });
    expect(await findUser()).toBeDefined();
  });

  test("ログインしていなければ 401", async () => {
    const res = await deleteMe();
    expect(res.status).toBe(401);
  });

  test("ほかのサイトから送られたら 403（CSRF 対策）", async () => {
    const headers = await loginAs(userId);
    headers.set("Origin", "https://evil.example");
    const res = await app.request("/api/me", { method: "DELETE", headers });

    expect(res.status).toBe(403);
    expect(await findUser()).toBeDefined();
  });
});
