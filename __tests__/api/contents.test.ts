// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import app from "@/server/app";
import { db } from "@/server/db";
import { memos, todoItems, users } from "@/server/db/schema";

import { loginAs } from "../helpers/test-auth";

// DB を、テスト用の DB（PGlite）に差し替える。Better Auth も同じ DB を使う
vi.mock("@/server/db", async () => {
  const { createTestDb } = await import("../helpers/test-db");
  return { db: await createTestDb() };
});

const userId = "user_1";
const otherUserId = "user_2";

type Widget = { id: string; type: string };

let headers: Headers;
let boardId: string;
let byType: Record<string, Widget>;

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

// 同意済みのユーザーを2人作り、user_1 にベーシック（ToDo・メモ・カウントダウンを含む）のボードを作る
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
  const board = await (
    await send("POST", "/api/boards", { templateId: "basic" })
  ).json();
  boardId = board.id;
  byType = Object.fromEntries(board.widgets.map((w: Widget) => [w.type, w]));
});

afterEach(async () => {
  await db.delete(users);
});

async function addItem(title: string) {
  const res = await send("POST", `/api/widgets/${byType.todo!.id}/todo-items`, {
    title,
  });
  return (await res.json()) as { id: string; sortOrder: number };
}

async function titlesInOrder() {
  const res = await send("GET", `/api/boards/${boardId}`);
  const board = await res.json();
  const todo = board.widgets.find((w: Widget) => w.type === "todo");
  return todo.todoItems.map((item: { title: string }) => item.title);
}

describe("ToDo の項目", () => {
  test("足すと、いちばん下に入り、ボードの中身にも出る", async () => {
    const res = await send(
      "POST",
      `/api/widgets/${byType.todo!.id}/todo-items`,
      { title: "  請求書を支払う  " },
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      title: "請求書を支払う",
      isDone: false,
      sortOrder: 0,
    });
    await addItem("母に電話する");
    expect(await titlesInOrder()).toEqual(["請求書を支払う", "母に電話する"]);
  });

  test("ToDo 以外のウィジェットには足せない（400）", async () => {
    const res = await send(
      "POST",
      `/api/widgets/${byType.memo!.id}/todo-items`,
      { title: "x" },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe(
      "ToDo のウィジェットではありません",
    );
  });

  test.each([[{ title: "   " }], [{ title: "あ".repeat(101) }], [{}]])(
    "文言が正しくなければ 400（%o）",
    async (body) => {
      const res = await send(
        "POST",
        `/api/widgets/${byType.todo!.id}/todo-items`,
        body,
      );
      expect(res.status).toBe(400);
    },
  );

  test("50件より多くは足せない", async () => {
    await db.insert(todoItems).values(
      Array.from({ length: 50 }, (_, i) => ({
        widgetId: byType.todo!.id,
        title: `項目${i}`,
        sortOrder: i,
      })),
    );
    const res = await send(
      "POST",
      `/api/widgets/${byType.todo!.id}/todo-items`,
      { title: "51件目" },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("項目は50件までです");
  });

  test("完了にできる（表示モードのチェック）", async () => {
    const item = await addItem("洗濯物を取り込む");
    const res = await send("PATCH", `/api/todo-items/${item.id}`, {
      isDone: true,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ isDone: true });
  });

  test("並べ替えると、ほかの項目の並び順も振り直す", async () => {
    await addItem("A");
    await addItem("B");
    const c = await addItem("C");

    const res = await send("PATCH", `/api/todo-items/${c.id}`, {
      sortOrder: 0,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: "C", sortOrder: 0 });
    expect(await titlesInOrder()).toEqual(["C", "A", "B"]);

    const rows = await db
      .select({ sortOrder: todoItems.sortOrder })
      .from(todoItems)
      .orderBy(todoItems.sortOrder);
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
  });

  test("変える値がなければ 400", async () => {
    const item = await addItem("A");
    const res = await send("PATCH", `/api/todo-items/${item.id}`, {});
    expect(res.status).toBe(400);
  });

  test("消せる", async () => {
    const item = await addItem("A");
    const res = await send("DELETE", `/api/todo-items/${item.id}`);
    expect(res.status).toBe(204);
    expect(await db.select().from(todoItems)).toHaveLength(0);
  });

  test("他人の項目は、変えられず消せない（404）", async () => {
    const item = await addItem("A");
    const other = await loginAs(otherUserId);
    expect(
      (
        await send(
          "PATCH",
          `/api/todo-items/${item.id}`,
          { isDone: true },
          other,
        )
      ).status,
    ).toBe(404);
    expect(
      (await send("DELETE", `/api/todo-items/${item.id}`, undefined, other))
        .status,
    ).toBe(404);
    expect(await db.select().from(todoItems)).toHaveLength(1);
  });

  test("ウィジェットごと消えると、項目も消える（ボードを作り直したときなど）", async () => {
    await addItem("A");
    await db.delete(users).where(eq(users.id, userId));
    expect(await db.select().from(todoItems)).toHaveLength(0);
  });
});

describe("メモ", () => {
  test("最初は本文がなく（null）、保存すると、ボードの中身に出る", async () => {
    let board = await (await send("GET", `/api/boards/${boardId}`)).json();
    expect(board.widgets.find((w: Widget) => w.type === "memo").memo).toBe(
      null,
    );

    const res = await send("PUT", `/api/widgets/${byType.memo!.id}/memo`, {
      body: "買い物：牛乳、卵",
    });
    expect(res.status).toBe(200);
    const saved = await res.json();
    expect(saved.body).toBe("買い物：牛乳、卵");
    expect(saved.updatedAt).toEqual(expect.any(String));

    board = await (await send("GET", `/api/boards/${boardId}`)).json();
    expect(board.widgets.find((w: Widget) => w.type === "memo").memo).toEqual(
      saved,
    );
  });

  test("もう一度保存すると、上書きする", async () => {
    await send("PUT", `/api/widgets/${byType.memo!.id}/memo`, { body: "1" });
    await send("PUT", `/api/widgets/${byType.memo!.id}/memo`, { body: "2" });
    const rows = await db.select().from(memos);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.body).toBe("2");
  });

  test("500文字より長いと 400", async () => {
    const res = await send("PUT", `/api/widgets/${byType.memo!.id}/memo`, {
      body: "あ".repeat(501),
    });
    expect(res.status).toBe(400);
  });

  test("メモ以外のウィジェットには保存できない（400）", async () => {
    const res = await send("PUT", `/api/widgets/${byType.todo!.id}/memo`, {
      body: "x",
    });
    expect(res.status).toBe(400);
  });

  test("他人のメモには保存できない（404）", async () => {
    const res = await send(
      "PUT",
      `/api/widgets/${byType.memo!.id}/memo`,
      { body: "x" },
      await loginAs(otherUserId),
    );
    expect(res.status).toBe(404);
  });
});

describe("設定（ToDo・メモ・カウントダウン）", () => {
  test("カウントダウンの設定を、初期値で埋めて保存する", async () => {
    const res = await send("PATCH", `/api/widgets/${byType.countdown!.id}`, {
      settings: { title: "京都旅行", date: "2026-11-21", suffix: "出発" },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).settings).toEqual({
      title: "京都旅行",
      date: "2026-11-21",
      suffix: "出発",
      unit: "days",
      showProgress: true,
      startDate: null,
    });
  });

  test("日付の形が正しくなければ 400", async () => {
    const res = await send("PATCH", `/api/widgets/${byType.countdown!.id}`, {
      settings: { date: "11/21" },
    });
    expect(res.status).toBe(400);
  });

  test("メモの色は決まった5色だけ", async () => {
    const ok = await send("PATCH", `/api/widgets/${byType.memo!.id}`, {
      settings: { color: "pink", fontSize: "large" },
    });
    expect(ok.status).toBe(200);
    const ng = await send("PATCH", `/api/widgets/${byType.memo!.id}`, {
      settings: { color: "red" },
    });
    expect(ng.status).toBe(400);
  });
});
