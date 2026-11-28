// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import app from "@/server/app";
import { db } from "@/server/db";
import { boards, sessions, users, widgets } from "@/server/db/schema";
import { auth, SESSION_EXPIRES_IN_SECONDS } from "@/server/auth";
import { countMyData } from "@/server/services/boards";

import { loginAs } from "../helpers/test-auth";

// DB を、テスト用の DB（PGlite）に差し替える。Better Auth も同じ DB を使う
vi.mock("@/server/db", async () => {
  const { createTestDb } = await import("../helpers/test-db");
  return { db: await createTestDb() };
});

const userId = "user_1";

// テストの前に、ユーザーを1人作っておく（登録したときに同意している）
const acceptedAt = new Date("2026-11-21T00:00:00.000Z");
let createdAt: Date;
beforeEach(async () => {
  const [created] = await db
    .insert(users)
    .values({
      id: userId,
      name: "Taro Google",
      email: "taro@example.com",
      termsAcceptedAt: acceptedAt,
    })
    .returning();
  createdAt = created!.createdAt;
});

afterEach(async () => {
  await db.delete(users);
});

async function findUser() {
  return db.query.users.findFirst({ where: eq(users.id, userId) });
}

// 同意した日時がないユーザーにする（同意の確認画面があったころに登録して、同意しなかった人）
async function clearTermsAcceptedAt() {
  await db
    .update(users)
    .set({ termsAcceptedAt: null })
    .where(eq(users.id, userId));
}

// セッションを11分前に作ったことにする（退会に必要な、再ログインの10分を過ぎる）
async function ageSessionBeyondReauth() {
  await db
    .update(sessions)
    .set({ createdAt: new Date(Date.now() - 11 * 60 * 1000) })
    .where(eq(sessions.userId, userId));
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
      termsAcceptedAt: acceptedAt.toISOString(),
      createdAt: createdAt.toISOString(),
    });
  });
});

describe("登録", () => {
  test("Google で登録すると、登録した日時を同意した日時として保存する", async () => {
    const ctx = await auth.$context;
    const before = Date.now();
    // Google で初めてログインしたときと同じ方法で、ユーザーを作る
    const { user } = await ctx.internalAdapter.createOAuthUser(
      { name: "Hanako", email: "hanako@example.com", emailVerified: true },
      { providerId: "google", accountId: "google-hanako" },
    );

    const saved = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(saved?.termsAcceptedAt).toBeInstanceOf(Date);
    expect(saved!.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(saved!.termsAcceptedAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("DELETE /api/me", () => {
  test("ログインしてから10分以内なら削除して、Cookie も消す", async () => {
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

  test("ログインしてから10分を過ぎていたら 403", async () => {
    const headers = await loginAs(userId);
    await ageSessionBeyondReauth();

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

  test("同意した日時がないユーザーも、10分を過ぎていたら 403（すぐには消さない）", async () => {
    await clearTermsAcceptedAt();
    const headers = await loginAs(userId);
    await ageSessionBeyondReauth();

    const res = await deleteMe(headers);

    expect(res.status).toBe(403);
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

function patchMe(body: unknown, headers?: Headers) {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  return app.request("/api/me", {
    method: "PATCH",
    headers: h,
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/me", () => {
  test("ユーザー名を、前後の空白を除いて保存する", async () => {
    const res = await patchMe({ name: "  Taro  " }, await loginAs(userId));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: userId, name: "Taro" });
    expect((await findUser())?.name).toBe("Taro");
  });

  test("空のユーザー名は 400", async () => {
    const res = await patchMe({ name: "   " }, await loginAs(userId));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "validation_error",
        message: "ユーザー名を入力してください",
      },
    });
    expect((await findUser())?.name).toBe("Taro Google");
  });

  test("51文字のユーザー名は 400", async () => {
    const res = await patchMe({ name: "あ".repeat(51) }, await loginAs(userId));
    expect(res.status).toBe(400);
  });

  test("同意した日時がないユーザーでも変えられる（確認画面で止めない）", async () => {
    await clearTermsAcceptedAt();
    const res = await patchMe({ name: "Taro" }, await loginAs(userId));

    expect(res.status).toBe(200);
    expect((await findUser())?.name).toBe("Taro");
  });

  test("ログインしていなければ 401", async () => {
    const res = await patchMe({ name: "Taro" });
    expect(res.status).toBe(401);
  });
});

describe("ログインの期限の延長", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  // 前に延ばしてから2日たったセッションにする（1日たてば延ばす対象になる）
  async function ageSession() {
    const twoDaysAgo = new Date(
      Date.now() + SESSION_EXPIRES_IN_SECONDS * 1000 - 2 * DAY_MS,
    );
    await db
      .update(sessions)
      .set({ expiresAt: twoDaysAgo })
      .where(eq(sessions.userId, userId));
    return twoDaysAgo;
  }

  async function sessionExpiresAt() {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.userId, userId),
    });
    return session!.expiresAt;
  }

  test("ログインの期限は30日", () => {
    expect(SESSION_EXPIRES_IN_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  test("Mado の API を呼んでも、期限は延ばさない（Cookie を送り直さないため）", async () => {
    const headers = await loginAs(userId);
    const before = await ageSession();

    const res = await app.request("/api/me", { headers });

    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect((await sessionExpiresAt()).getTime()).toBe(before.getTime());
  });

  test("/api/auth/get-session を呼ぶと、DB と Cookie の期限を一緒に30日先まで延ばす", async () => {
    const headers = await loginAs(userId);
    await ageSession();

    const res = await app.request("/api/auth/get-session", { headers });

    expect(res.status).toBe(200);
    const expiresAt = await sessionExpiresAt();
    expect(expiresAt.getTime()).toBeGreaterThan(
      Date.now() + SESSION_EXPIRES_IN_SECONDS * 1000 - 60 * 1000,
    );
    // Cookie の期限も30日になる
    expect(res.headers.get("Set-Cookie")).toContain(
      `Max-Age=${SESSION_EXPIRES_IN_SECONDS}`,
    );
  });
});

describe("countMyData（退会の確認で見せる数）", () => {
  test("ボードがなければ0件", async () => {
    expect(await countMyData(userId)).toEqual({ boards: 0, widgets: 0 });
  });

  test("自分のボードとウィジェットの数を数える", async () => {
    const [board] = await db
      .insert(boards)
      .values({ userId, name: "マイボード" })
      .returning();
    await db.insert(widgets).values([
      { boardId: board!.id, type: "clock" },
      { boardId: board!.id, type: "memo" },
    ]);
    // ほかの人のボードは数えない
    await db
      .insert(users)
      .values({ id: "user_2", name: "Hanako", email: "hanako@example.com" });
    const [other] = await db
      .insert(boards)
      .values({ userId: "user_2", name: "マイボード" })
      .returning();
    await db.insert(widgets).values({ boardId: other!.id, type: "clock" });

    expect(await countMyData(userId)).toEqual({ boards: 1, widgets: 2 });
  });
});
