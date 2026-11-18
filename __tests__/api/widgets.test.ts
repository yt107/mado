// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import app from "@/server/app";
import { db } from "@/server/db";
import { users, widgetPlacements, widgets } from "@/server/db/schema";

import { loginAs } from "../helpers/test-auth";

// DB を、テスト用の DB（PGlite）に差し替える。Better Auth も同じ DB を使う
vi.mock("@/server/db", async () => {
  const { createTestDb } = await import("../helpers/test-db");
  return { db: await createTestDb() };
});

const userId = "user_1";
const otherUserId = "user_2";

type Widget = {
  id: string;
  type: string;
  settings: Record<string, unknown>;
  placements: { displayTarget: string; x: number; y: number }[];
};

let headers: Headers;
let boardId: string;
let widgetsByType: Record<string, Widget>;

function send(method: string, path: string, body?: unknown, h = headers) {
  const requestHeaders = new Headers(h);
  // ブラウザが同じサイトから送るときと同じヘッダー（CSRF 対策の確認を通る）
  requestHeaders.set("Origin", "http://localhost");
  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }
  return app.request(path, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// 同意済みのユーザーを2人作り、user_1 にスタンバイ（時計・天気・カレンダー）のボードを作る
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
  headers = await loginAs(userId);
  const res = await send("POST", "/api/boards", { templateId: "standby" });
  const board = await res.json();
  boardId = board.id;
  widgetsByType = Object.fromEntries(
    board.widgets.map((w: Widget) => [w.type, w]),
  );
});

afterEach(async () => {
  await db.delete(users);
});

async function placementOf(widgetId: string, target: string) {
  const rows = await db
    .select()
    .from(widgetPlacements)
    .where(eq(widgetPlacements.widgetId, widgetId));
  return rows.find((row) => row.displayTarget === target);
}

describe("POST /api/boards/:boardId/widgets（置く）", () => {
  // スタンバイの PC は、時計(0,0,3,3)・天気(3,0,1,1)・カレンダー(3,1,1,2) で埋まっている。
  // 外してから置けるように、天気を外しておく
  async function freeWeatherCell() {
    await send(
      "DELETE",
      `/api/widgets/${widgetsByType.weather!.id}/placements/pc`,
    );
  }

  test("新しい種類を置くと、ウィジェットと配置ができる", async () => {
    await freeWeatherCell();
    const res = await send("POST", `/api/boards/${boardId}/widgets`, {
      type: "todo",
      displayTarget: "pc",
      page: 1,
      x: 3,
      y: 0,
      w: 1,
      h: 1,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      type: "todo",
      placements: [{ displayTarget: "pc", page: 1, x: 3, y: 0, w: 1, h: 1 }],
    });
  });

  test("一度外した種類を置き直すと、同じウィジェット（設定のまま）に配置が戻る", async () => {
    const clock = widgetsByType.clock!;
    await send("PATCH", `/api/widgets/${clock.id}`, {
      settings: { hourCycle: "12h" },
    });
    await send("DELETE", `/api/widgets/${clock.id}/placements/pc`);

    const res = await send("POST", `/api/boards/${boardId}/widgets`, {
      type: "clock",
      displayTarget: "pc",
      page: 1,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(clock.id);
    expect(body.settings.hourCycle).toBe("12h");
    expect(await db.select().from(widgets)).toHaveLength(3);
  });

  test("この表示先にもう置いてあれば 409", async () => {
    const res = await send("POST", `/api/boards/${boardId}/widgets`, {
      type: "clock",
      displayTarget: "pc",
      page: 1,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "conflict",
        message: "この表示先には、もう置いてあります",
      },
    });
  });

  test("ほかと重なるなら 409", async () => {
    const res = await send("POST", `/api/boards/${boardId}/widgets`, {
      type: "todo",
      displayTarget: "pc",
      page: 1,
      x: 2,
      y: 2,
      w: 1,
      h: 1,
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toBe(
      "ほかのウィジェットと重なっています",
    );
  });

  test("グリッドからはみ出すなら 400", async () => {
    await freeWeatherCell();
    const res = await send("POST", `/api/boards/${boardId}/widgets`, {
      type: "todo",
      displayTarget: "pc",
      page: 1,
      x: 3,
      y: 0,
      w: 2,
      h: 1,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe(
      "グリッドからはみ出しています",
    );
  });

  test("他人のボードには置けない（404）", async () => {
    const res = await send(
      "POST",
      `/api/boards/${boardId}/widgets`,
      { type: "todo", displayTarget: "pc", page: 1, x: 3, y: 0, w: 1, h: 1 },
      await loginAs(otherUserId),
    );
    expect(res.status).toBe(404);
  });

  test.each([
    [{ type: "todo", displayTarget: "tv", page: 1, x: 0, y: 0, w: 1, h: 1 }],
    [{ type: "game", displayTarget: "pc", page: 1, x: 0, y: 0, w: 1, h: 1 }],
    [{ type: "todo", displayTarget: "pc", page: 0, x: 0, y: 0, w: 1, h: 1 }],
    [{ type: "todo", displayTarget: "pc", page: 1, x: 0.5, y: 0, w: 1, h: 1 }],
  ])("値が正しくなければ 400（%o）", async (body) => {
    const res = await send("POST", `/api/boards/${boardId}/widgets`, body);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/widgets/:widgetId/placements/:displayTarget（動かす）", () => {
  test("動かすと、配置が変わる", async () => {
    const calendar = widgetsByType.calendar!;
    await send(
      "DELETE",
      `/api/widgets/${widgetsByType.weather!.id}/placements/pc`,
    );

    const res = await send("PUT", `/api/widgets/${calendar.id}/placements/pc`, {
      page: 1,
      x: 3,
      y: 0,
      w: 1,
      h: 3,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      displayTarget: "pc",
      page: 1,
      x: 3,
      y: 0,
      w: 1,
      h: 3,
    });
    expect(await placementOf(calendar.id, "pc")).toMatchObject({ y: 0, h: 3 });
  });

  test("自分とは重なっていてもよい（大きさを変えるとき）", async () => {
    const clock = widgetsByType.clock!;
    const res = await send("PUT", `/api/widgets/${clock.id}/placements/pc`, {
      page: 1,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
    expect(res.status).toBe(200);
  });

  test("ほかと重なるなら 409 で、配置は変わらない", async () => {
    const clock = widgetsByType.clock!;
    const res = await send("PUT", `/api/widgets/${clock.id}/placements/pc`, {
      page: 1,
      x: 0,
      y: 0,
      w: 4,
      h: 3,
    });
    expect(res.status).toBe(409);
    expect(await placementOf(clock.id, "pc")).toMatchObject({ w: 3, h: 3 });
  });

  test("まだ置いていない表示先なら、新しく置く", async () => {
    const clock = widgetsByType.clock!;
    await send("DELETE", `/api/widgets/${clock.id}/placements/phone_landscape`);
    const res = await send(
      "PUT",
      `/api/widgets/${clock.id}/placements/phone_landscape`,
      { page: 1, x: 0, y: 0, w: 1, h: 1 },
    );
    expect(res.status).toBe(200);
    expect(await placementOf(clock.id, "phone_landscape")).toMatchObject({
      w: 1,
      h: 1,
    });
  });

  test("グリッドからはみ出すなら 400（スマホ縦は3ページ目がない）", async () => {
    const clock = widgetsByType.clock!;
    const res = await send(
      "PUT",
      `/api/widgets/${clock.id}/placements/phone_portrait`,
      { page: 3, x: 0, y: 0, w: 1, h: 1 },
    );
    expect(res.status).toBe(400);
  });

  test("他人のウィジェットは 404", async () => {
    const res = await send(
      "PUT",
      `/api/widgets/${widgetsByType.clock!.id}/placements/pc`,
      { page: 1, x: 0, y: 0, w: 1, h: 1 },
      await loginAs(otherUserId),
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/widgets/:widgetId/placements/:displayTarget（外す）", () => {
  test("その表示先の配置だけ消し、ほかの表示先とウィジェットは残る", async () => {
    const clock = widgetsByType.clock!;
    const res = await send("DELETE", `/api/widgets/${clock.id}/placements/pc`);

    expect(res.status).toBe(204);
    expect(await placementOf(clock.id, "pc")).toBeUndefined();
    expect(await placementOf(clock.id, "tablet_portrait")).toBeDefined();
    expect(await db.select().from(widgets)).toHaveLength(3);
  });

  test("他人のウィジェットは 404 で、消えない", async () => {
    const clock = widgetsByType.clock!;
    const res = await send(
      "DELETE",
      `/api/widgets/${clock.id}/placements/pc`,
      undefined,
      await loginAs(otherUserId),
    );
    expect(res.status).toBe(404);
    expect(await placementOf(clock.id, "pc")).toBeDefined();
  });

  test("ほかのサイトから送られたら 403（CSRF 対策）", async () => {
    const h = new Headers(headers);
    h.set("Origin", "https://evil.example.com");
    const res = await app.request(
      `/api/widgets/${widgetsByType.clock!.id}/placements/pc`,
      { method: "DELETE", headers: h },
    );
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/widgets/:widgetId（設定）", () => {
  test("時計の設定を変えると、初期値で埋めて保存する", async () => {
    const clock = widgetsByType.clock!;
    const res = await send("PATCH", `/api/widgets/${clock.id}`, {
      settings: { hourCycle: "12h", worldClocks: ["london"] },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toEqual({
      hourCycle: "12h",
      showSeconds: true,
      showDate: true,
      dateFormat: "monthDayWeekday",
      textStyle: "thin",
      city: "tokyo",
      worldClocks: ["london"],
    });
  });

  test("設定が正しくなければ 400 で、保存しない", async () => {
    const clock = widgetsByType.clock!;
    const res = await send("PATCH", `/api/widgets/${clock.id}`, {
      settings: {
        worldClocks: ["london", "paris", "berlin", "seoul", "sydney"],
      },
    });
    expect(res.status).toBe(400);

    const [saved] = await db
      .select()
      .from(widgets)
      .where(eq(widgets.id, clock.id));
    expect(saved?.settings).toMatchObject({ worldClocks: [] });
  });

  test("設定をまだ作っていない種類は 400", async () => {
    const res = await send(
      "PATCH",
      `/api/widgets/${widgetsByType.weather!.id}`,
      { settings: { unit: "c" } },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe(
      "このウィジェットの設定は、まだ変えられません",
    );
  });

  test("他人のウィジェットは 404", async () => {
    const res = await send(
      "PATCH",
      `/api/widgets/${widgetsByType.clock!.id}`,
      { settings: {} },
      await loginAs(otherUserId),
    );
    expect(res.status).toBe(404);
  });
});
