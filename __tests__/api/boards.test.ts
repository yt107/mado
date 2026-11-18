// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import app from "@/server/app";
import { db } from "@/server/db";
import { boards, users, widgetPlacements, widgets } from "@/server/db/schema";

import { loginAs } from "../helpers/test-auth";

// DB を、テスト用の DB（PGlite）に差し替える。Better Auth も同じ DB を使う
vi.mock("@/server/db", async () => {
  const { createTestDb } = await import("../helpers/test-db");
  return { db: await createTestDb() };
});

const userId = "user_1";
const otherUserId = "user_2";

// テストの前に、同意済みのユーザーを2人作っておく
beforeEach(async () => {
  await db.insert(users).values([
    {
      id: userId,
      name: "Taro",
      email: "taro@example.com",
      termsAcceptedAt: new Date(),
    },
    {
      id: otherUserId,
      name: "Hanako",
      email: "hanako@example.com",
      termsAcceptedAt: new Date(),
    },
  ]);
});

afterEach(async () => {
  await db.delete(users);
});

function postBoard(body: unknown, headers?: Headers) {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  return app.request("/api/boards", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

describe("ログインと同意", () => {
  test.each([
    ["GET", "/api/boards"],
    ["POST", "/api/boards"],
    ["GET", "/api/boards/00000000-0000-4000-8000-000000000000"],
  ])("ログインしていなければ 401（%s %s）", async (method, path) => {
    const res = await app.request(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: method === "POST" ? JSON.stringify({ templateId: "basic" }) : null,
    });
    expect(res.status).toBe(401);
  });

  test("利用規約に同意していなければ 403", async () => {
    await db
      .update(users)
      .set({ termsAcceptedAt: null })
      .where(eq(users.id, userId));
    const res = await app.request("/api/boards", {
      headers: await loginAs(userId),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        code: "terms_not_accepted",
        message: "利用規約に同意してください",
      },
    });
  });
});

describe("POST /api/boards", () => {
  test("ベーシックを選ぶと、ウィジェットと6つの表示先の配置ができる", async () => {
    const res = await postBoard({ templateId: "basic" }, await loginAs(userId));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("マイボード");
    expect(body.widgets.map((w: { type: string }) => w.type)).toEqual([
      "clock",
      "weather",
      "calendar",
      "todo",
      "memo",
      "countdown",
    ]);

    // 時計は、初期値で埋めた設定を保存する
    const clock = body.widgets[0];
    expect(clock.settings).toMatchObject({
      hourCycle: "24h",
      city: "tokyo",
      worldClocks: ["new_york", "london", "sydney"],
    });
    expect(clock.placements).toContainEqual({
      displayTarget: "pc",
      page: 1,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
    expect(clock.placements).toHaveLength(6);

    // DB にも入っている
    expect(await db.select().from(widgets)).toHaveLength(6);
    // メモと ToDo はスマホ横に置かないので、6種類×6表示先より2つ少ない
    expect(await db.select().from(widgetPlacements)).toHaveLength(34);
  });

  test("白紙なら、ウィジェットのないボードができる", async () => {
    const res = await postBoard({ templateId: "blank" }, await loginAs(userId));

    expect(res.status).toBe(201);
    expect((await res.json()).widgets).toEqual([]);
  });

  test("ボードがもうあれば 409 で、2つ目はできない", async () => {
    const headers = await loginAs(userId);
    await postBoard({ templateId: "basic" }, headers);
    const res = await postBoard({ templateId: "standby" }, headers);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "conflict", message: "ボードはもうあります" },
    });
    expect(
      await db.select().from(boards).where(eq(boards.userId, userId)),
    ).toHaveLength(1);
  });

  test("同時に2回送っても、ボードは1つだけ", async () => {
    const headers = await loginAs(userId);
    const results = await Promise.all([
      postBoard({ templateId: "basic" }, headers),
      postBoard({ templateId: "family" }, headers),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(
      await db.select().from(boards).where(eq(boards.userId, userId)),
    ).toHaveLength(1);
  });

  test.each([[{ templateId: "unknown" }], [{}]])(
    "知らないテンプレートなら 400（%o）",
    async (body) => {
      const res = await postBoard(body, await loginAs(userId));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: {
          code: "validation_error",
          message: "テンプレートを選んでください",
        },
      });
    },
  );

  test("ほかのサイトから送られたら 403（CSRF 対策）", async () => {
    const headers = await loginAs(userId);
    headers.set("Origin", "https://evil.example.com");
    const res = await app.request("/api/boards", {
      method: "POST",
      headers,
      body: "templateId=basic",
    });

    expect(res.status).toBe(403);
    expect(await db.select().from(boards)).toHaveLength(0);
  });
});

describe("GET /api/boards", () => {
  test("まだなければ空", async () => {
    const res = await app.request("/api/boards", {
      headers: await loginAs(userId),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ boards: [] });
  });

  test("自分のボードだけを返す", async () => {
    await postBoard({ templateId: "basic" }, await loginAs(otherUserId));
    const headers = await loginAs(userId);
    const created = await (
      await postBoard({ templateId: "basic" }, headers)
    ).json();

    const res = await app.request("/api/boards", { headers });
    expect(await res.json()).toEqual({
      boards: [{ id: created.id, name: "マイボード", sortOrder: 0 }],
    });
  });
});

describe("GET /api/boards/:boardId", () => {
  test("自分のボードの中身", async () => {
    const headers = await loginAs(userId);
    const created = await (
      await postBoard({ templateId: "standby" }, headers)
    ).json();

    const res = await app.request(`/api/boards/${created.id}`, { headers });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(created);
  });

  test("他人のボードは 404", async () => {
    const others = await (
      await postBoard({ templateId: "basic" }, await loginAs(otherUserId))
    ).json();

    const res = await app.request(`/api/boards/${others.id}`, {
      headers: await loginAs(userId),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "not_found", message: "ボードが見つかりません" },
    });
  });

  test("ID の形が正しくなければ 400", async () => {
    const res = await app.request("/api/boards/not-a-uuid", {
      headers: await loginAs(userId),
    });
    expect(res.status).toBe(400);
  });
});
