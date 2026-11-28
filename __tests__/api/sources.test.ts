// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import app from "@/server/app";
import { db } from "@/server/db";
import { calendarSubscriptions, newsFeeds, users } from "@/server/db/schema";
import { SafeFetchError } from "@/server/net/safe-fetch";

import { loginAs } from "../helpers/test-auth";

// DB を、テスト用の DB（PGlite）に差し替える。Better Auth も同じ DB を使う
vi.mock("@/server/db", async () => {
  const { createTestDb } = await import("../helpers/test-db");
  return { db: await createTestDb() };
});

// 外の URL は読みに行かず、URL ごとに決めた中身を返す（URL の確認は本物を使う）
const pages = vi.hoisted(
  () => new Map<string, { text: string; contentType?: string } | Error>(),
);
vi.mock("@/server/net/safe-fetch", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/net/safe-fetch")>();
  return {
    ...actual,
    safeFetch: vi.fn(async (rawUrl: string) => {
      const url = actual.parsePublicUrl(rawUrl).href;
      const page = pages.get(url);
      if (!page) {
        throw new actual.SafeFetchError("not_found", "サイトが見つかりません");
      }
      if (page instanceof Error) throw page;
      return { url, contentType: page.contentType ?? "", text: page.text };
    }),
  };
});

const userId = "user_1";
const otherUserId = "user_2";
const CALENDAR_URL =
  "https://calendar.example.com/calendar/ical/me/private-secret/basic.ics";

type Widget = { id: string; type: string };

let headers: Headers;
let boardId: string;
let byType: Record<string, Widget>;

function send(method: string, path: string, body?: unknown, h = headers) {
  const requestHeaders = new Headers(h);
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

function ics(name: string, ...events: string[][]) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `X-WR-CALNAME:${name}`,
    ...events.flatMap((lines) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"]),
    "END:VCALENDAR",
  ].join("\r\n");
}

function rss(title: string, ...items: [string, string, string][]) {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title>${items
    .map(
      ([itemTitle, link, date]) =>
        `<item><title>${itemTitle}</title><link>${link}</link><pubDate>${date}</pubDate></item>`,
    )
    .join("")}</channel></rss>`;
}

beforeEach(async () => {
  vi.stubEnv("ENCRYPTION_KEY", btoa("k".repeat(32)));
  pages.clear();
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
  // ワークデスクには、天気・カレンダー・ニュースが入っている
  const board = await (
    await send("POST", "/api/boards", { templateId: "workdesk" })
  ).json();
  boardId = board.id;
  byType = Object.fromEntries(board.widgets.map((w: Widget) => [w.type, w]));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await db.delete(users);
});

async function boardWidget(type: string) {
  const board = await (await send("GET", `/api/boards/${boardId}`)).json();
  return board.widgets.find((w: Widget) => w.type === type);
}

describe("POST /api/boards（地域）", () => {
  test("選んだ地域を、天気のウィジェットの設定に入れる", async () => {
    await db.delete(users).where(eq(users.id, otherUserId));
    await db.insert(users).values({
      id: otherUserId,
      name: "Hanako",
      email: "hanako@example.com",
      termsAcceptedAt: new Date(),
    });
    const other = await loginAs(otherUserId);
    const location = {
      name: "渋谷",
      region: "東京都 渋谷区",
      latitude: 35.6589,
      longitude: 139.70665,
    };
    const res = await send(
      "POST",
      "/api/boards",
      { templateId: "basic", location },
      other,
    );
    expect(res.status).toBe(201);
    const board = await res.json();
    const weather = board.widgets.find((w: Widget) => w.type === "weather");
    expect(weather.settings.location).toEqual(location);
    expect(weather.settings.refreshMinutes).toBe(30);
  });
});

describe("カレンダーの購読先", () => {
  const path = () =>
    `/api/widgets/${byType.calendar!.id}/calendar-subscriptions`;

  test("iCal として読めたら登録し、URL は暗号化して保存し、返さない", async () => {
    pages.set(CALENDAR_URL, { text: ics("仕事") });
    const res = await send("POST", path(), { url: CALENDAR_URL });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toEqual({
      id: expect.any(String),
      name: "仕事",
      color: "blue",
      lastFetchedAt: expect.any(String),
      lastError: null,
    });

    const [row] = await db
      .select({ urlEncrypted: calendarSubscriptions.urlEncrypted })
      .from(calendarSubscriptions);
    expect(new TextDecoder().decode(row!.urlEncrypted)).not.toContain(
      "private-secret",
    );

    // ボードの中身にも、URL は入らない
    const widget = await boardWidget("calendar");
    expect(widget.calendarSubscriptions).toEqual([created]);
    expect(JSON.stringify(widget)).not.toContain("private-secret");
  });

  test("webcal:// も受け付け、2つめには別の色を付ける", async () => {
    pages.set(CALENDAR_URL, { text: ics("仕事") });
    pages.set("https://calendar.example.com/family.ics", {
      text: ics("家族"),
    });
    await send("POST", path(), { url: CALENDAR_URL });
    const res = await send("POST", path(), {
      url: "webcal://calendar.example.com/family.ics",
    });
    expect(res.status).toBe(201);
    expect((await res.json()).color).toBe("green");
  });

  test("https でない・内側の URL は 400、読めない・iCal でないものは 422", async () => {
    let res = await send("POST", path(), { url: "http://example.com/a.ics" });
    expect(res.status).toBe(400);
    res = await send("POST", path(), { url: "https://localhost/a.ics" });
    expect(res.status).toBe(400);

    res = await send("POST", path(), { url: "https://example.com/none.ics" });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("fetch_failed");

    pages.set("https://example.com/page", { text: "<html></html>" });
    res = await send("POST", path(), { url: "https://example.com/page" });
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toBe("iCal の形式ではありません");
    expect(await db.select().from(calendarSubscriptions)).toHaveLength(0);
  });

  test("カレンダーでないウィジェットには 400、他人のウィジェットは 404", async () => {
    pages.set(CALENDAR_URL, { text: ics("仕事") });
    let res = await send(
      "POST",
      `/api/widgets/${byType.weather!.id}/calendar-subscriptions`,
      { url: CALENDAR_URL },
    );
    expect(res.status).toBe(400);
    res = await send(
      "POST",
      path(),
      { url: CALENDAR_URL },
      await loginAs(otherUserId),
    );
    expect(res.status).toBe(404);
  });

  test("10個までしか登録できない", async () => {
    for (let i = 0; i < 10; i++) {
      const url = `https://calendar.example.com/${i}.ics`;
      pages.set(url, { text: ics(`カレンダー${i}`) });
      expect((await send("POST", path(), { url })).status).toBe(201);
    }
    pages.set(CALENDAR_URL, { text: ics("11個め") });
    const res = await send("POST", path(), { url: CALENDAR_URL });
    expect(res.status).toBe(400);
  });

  test("名前と色を変え、登録をやめられる。他人のものは 404", async () => {
    pages.set(CALENDAR_URL, { text: ics("仕事") });
    const { id } = await (
      await send("POST", path(), { url: CALENDAR_URL })
    ).json();

    let res = await send("PATCH", `/api/calendar-subscriptions/${id}`, {
      name: "  会社 ",
      color: "purple",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "会社", color: "purple" });

    res = await send("PATCH", `/api/calendar-subscriptions/${id}`, {});
    expect(res.status).toBe(400);

    const other = await loginAs(otherUserId);
    res = await send(
      "DELETE",
      `/api/calendar-subscriptions/${id}`,
      undefined,
      other,
    );
    expect(res.status).toBe(404);

    res = await send("DELETE", `/api/calendar-subscriptions/${id}`);
    expect(res.status).toBe(204);
    expect(await db.select().from(calendarSubscriptions)).toHaveLength(0);
  });
});

describe("GET /api/widgets/:widgetId/calendar-events", () => {
  const eventsPath = (query: string) =>
    `/api/widgets/${byType.calendar!.id}/calendar-events?${query}`;

  test("登録したカレンダーの予定をまとめて返し、読めなかったものは理由を残す", async () => {
    pages.set(CALENDAR_URL, {
      text: ics(
        "仕事",
        [
          "UID:1",
          "SUMMARY:チーム定例",
          "DTSTART:20261106T010000Z",
          "DTEND:20261106T020000Z",
        ],
        ["UID:2", "SUMMARY:来年", "DTSTART:20270106T010000Z"],
      ),
    });
    pages.set("https://calendar.example.com/gym.ics", { text: ics("ジム") });
    const work = await (
      await send(
        "POST",
        `/api/widgets/${byType.calendar!.id}/calendar-subscriptions`,
        { url: CALENDAR_URL },
      )
    ).json();
    const gym = await (
      await send(
        "POST",
        `/api/widgets/${byType.calendar!.id}/calendar-subscriptions`,
        { url: "https://calendar.example.com/gym.ics" },
      )
    ).json();
    // ジムのカレンダーが読めなくなった
    pages.set(
      "https://calendar.example.com/gym.ics",
      new SafeFetchError("timeout", "時間内に応答がありません"),
    );

    const res = await send("GET", eventsPath("from=2026-11-01&to=2026-12-05"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toEqual([
      {
        id: expect.any(String),
        subscriptionId: work.id,
        title: "チーム定例",
        start: "2026-11-06T01:00:00.000Z",
        end: "2026-11-06T02:00:00.000Z",
        allDay: false,
      },
    ]);
    expect(body.subscriptions).toEqual([
      expect.objectContaining({ id: work.id, lastError: null }),
      expect.objectContaining({
        id: gym.id,
        lastError: "時間内に応答がありません",
      }),
    ]);
    // 読めなかったことは、ボードの中身（編集のパネル）にも出る
    const widget = await boardWidget("calendar");
    expect(widget.calendarSubscriptions[1].lastError).toBe(
      "時間内に応答がありません",
    );
  });

  test("期間が正しくなければ 400", async () => {
    expect(
      (await send("GET", eventsPath("from=2026-11-10&to=2026-11-01"))).status,
    ).toBe(400);
    expect(
      (await send("GET", eventsPath("from=2026-11-01&to=2027-02-01"))).status,
    ).toBe(400);
    expect((await send("GET", eventsPath("from=11/1&to=12/1"))).status).toBe(
      400,
    );
  });
});

describe("ニュースのフィード", () => {
  const path = () => `/api/widgets/${byType.news!.id}/news-feeds`;

  test("フィードの URL なら、そのまま登録する", async () => {
    pages.set("https://news.example.com/rss", {
      text: rss("テストニュース", [
        "A",
        "https://news.example.com/a",
        "Thu, 19 Nov 2026 10:00:00 +0900",
      ]),
    });
    const res = await send("POST", path(), {
      url: "https://news.example.com/rss",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      title: "テストニュース",
      feedUrl: "https://news.example.com/rss",
      sortOrder: 0,
      visible: true,
      lastFetchedAt: expect.any(String),
      lastError: null,
    });
  });

  test("サイトの URL なら、ページの中からフィードを探す", async () => {
    pages.set("https://blog.example.com/", {
      text: '<html><head><link rel="alternate" type="application/atom+xml" href="/atom.xml"></head></html>',
    });
    pages.set("https://blog.example.com/atom.xml", {
      text: '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>ブログ</title><entry><title>はじめての記事</title><link href="https://blog.example.com/1"/></entry></feed>',
    });
    const res = await send("POST", path(), {
      url: "https://blog.example.com/",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      title: "ブログ",
      feedUrl: "https://blog.example.com/atom.xml",
    });

    // 同じフィードは2回登録できない
    const again = await send("POST", path(), {
      url: "https://blog.example.com/atom.xml",
    });
    expect(again.status).toBe(409);
  });

  test("フィードが見つからなければ 422", async () => {
    pages.set("https://plain.example.com/", { text: "<html></html>" });
    const res = await send("POST", path(), {
      url: "https://plain.example.com/",
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toBe(
      "RSS・Atom のフィードが見つかりませんでした",
    );
  });

  test("記事をフィードごとに新しい順で返し、並べ替え・削除もできる", async () => {
    pages.set("https://a.example.com/rss", {
      text: rss(
        "A",
        ["A1", "https://a.example.com/1", "Thu, 19 Nov 2026 09:00:00 +0900"],
        ["A2", "https://a.example.com/2", "Thu, 19 Nov 2026 07:00:00 +0900"],
      ),
    });
    pages.set("https://b.example.com/rss", {
      text: rss("B", [
        "B1",
        "https://b.example.com/1",
        "Thu, 19 Nov 2026 08:00:00 +0900",
      ]),
    });
    const a = await (
      await send("POST", path(), { url: "https://a.example.com/rss" })
    ).json();
    const b = await (
      await send("POST", path(), { url: "https://b.example.com/rss" })
    ).json();

    const res = await send("GET", `/api/widgets/${byType.news!.id}/news-items`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((item: { title: string }) => item.title)).toEqual([
      "A1",
      "A2",
      "B1",
    ]);
    expect(body.items[2]).toMatchObject({
      feedId: b.id,
      link: "https://b.example.com/1",
    });

    // B をいちばん上に
    const moved = await send("PATCH", `/api/news-feeds/${b.id}`, {
      sortOrder: 0,
    });
    expect((await moved.json()).sortOrder).toBe(0);
    const widget = await boardWidget("news");
    expect(widget.newsFeeds.map((f: { id: string }) => f.id)).toEqual([
      b.id,
      a.id,
    ]);

    expect((await send("DELETE", `/api/news-feeds/${a.id}`)).status).toBe(204);
    expect(await db.select().from(newsFeeds)).toHaveLength(1);
  });

  test("隠したフィードは読まず、記事も返さない", async () => {
    pages.set("https://a.example.com/rss", {
      text: rss("A", [
        "A1",
        "https://a.example.com/1",
        "Thu, 19 Nov 2026 09:00:00 +0900",
      ]),
    });
    pages.set("https://b.example.com/rss", {
      text: rss("B", [
        "B1",
        "https://b.example.com/1",
        "Thu, 19 Nov 2026 08:00:00 +0900",
      ]),
    });
    await send("POST", path(), { url: "https://a.example.com/rss" });
    const b = await (
      await send("POST", path(), { url: "https://b.example.com/rss" })
    ).json();

    const hidden = await send("PATCH", `/api/news-feeds/${b.id}`, {
      visible: false,
    });
    expect(hidden.status).toBe(200);
    expect(await hidden.json()).toMatchObject({ id: b.id, visible: false });
    const widget = await boardWidget("news");
    expect(
      widget.newsFeeds.map((f: { visible: boolean }) => f.visible),
    ).toEqual([true, false]);

    // B のページが読めなくなっても、隠しているので読みに行かない
    pages.set("https://b.example.com/rss", new Error("読まないはず"));
    const res = await send("GET", `/api/widgets/${byType.news!.id}/news-items`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.feeds.map((f: { title: string }) => f.title)).toEqual(["A"]);
    expect(body.items.map((item: { title: string }) => item.title)).toEqual([
      "A1",
    ]);

    // 表示に戻せる
    const shown = await send("PATCH", `/api/news-feeds/${b.id}`, {
      visible: true,
    });
    expect((await shown.json()).visible).toBe(true);
  });

  test("feeds を渡すと、そのフィードを読む（隠したままでも）", async () => {
    pages.set("https://a.example.com/rss", {
      text: rss("A", [
        "A1",
        "https://a.example.com/1",
        "Thu, 19 Nov 2026 09:00:00 +0900",
      ]),
    });
    pages.set("https://b.example.com/rss", {
      text: rss("B", [
        "B1",
        "https://b.example.com/1",
        "Thu, 19 Nov 2026 10:00:00 +0900",
      ]),
    });
    const a = await (
      await send("POST", path(), { url: "https://a.example.com/rss" })
    ).json();
    const b = await (
      await send("POST", path(), { url: "https://b.example.com/rss" })
    ).json();
    await send("PATCH", `/api/news-feeds/${b.id}`, { visible: false });

    const items = (query: string) =>
      send("GET", `/api/widgets/${byType.news!.id}/news-items?${query}`);
    const titles = async (query: string) =>
      (await (await items(query)).json()).items.map(
        (item: { title: string }) => item.title,
      );

    // 画面で表示に戻した直後（保存が終わる前）でも、B を読む
    expect(await titles(`feeds=${a.id},${b.id}`)).toEqual(["A1", "B1"]);
    expect(await titles(`feeds=${b.id}`)).toEqual(["B1"]);
    // ほかのウィジェットのフィードの ID は無視する
    expect(await titles(`feeds=${a.id},${crypto.randomUUID()}`)).toEqual([
      "A1",
    ]);
    // ID の形が正しくなければ 400
    expect((await items("feeds=abc")).status).toBe(400);
    expect((await items("feeds=")).status).toBe(400);
  });

  test("1つのフィードからは、新しい記事を10件まで返す", async () => {
    const items = Array.from(
      { length: 12 },
      (_, i) =>
        [
          `記事${i + 1}`,
          `https://many.example.com/${i + 1}`,
          // 記事1がいちばん古く、記事12がいちばん新しい
          `Thu, 19 Nov 2026 ${String(i + 1).padStart(2, "0")}:00:00 +0900`,
        ] as [string, string, string],
    );
    pages.set("https://many.example.com/rss", { text: rss("多い", ...items) });
    await send("POST", path(), { url: "https://many.example.com/rss" });

    const body = await (
      await send("GET", `/api/widgets/${byType.news!.id}/news-items`)
    ).json();
    expect(body.items).toHaveLength(10);
    expect(body.items[0].title).toBe("記事12");
    expect(body.items[9].title).toBe("記事3");
  });

  test("フィードの変更で、変える値がなければ 400", async () => {
    pages.set("https://a.example.com/rss", {
      text: rss("A", [
        "A1",
        "https://a.example.com/1",
        "Thu, 19 Nov 2026 09:00:00 +0900",
      ]),
    });
    const a = await (
      await send("POST", path(), { url: "https://a.example.com/rss" })
    ).json();
    expect((await send("PATCH", `/api/news-feeds/${a.id}`, {})).status).toBe(
      400,
    );
  });
});
