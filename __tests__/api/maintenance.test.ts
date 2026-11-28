// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import app from "@/server/app";
import { db } from "@/server/db";
import { sessions, users, verifications } from "@/server/db/schema";

// DB を、テスト用の DB（PGlite）に差し替える
vi.mock("@/server/db", async () => {
  const { createTestDb } = await import("../helpers/test-db");
  return { db: await createTestDb() };
});

const SECRET = "test-cron-secret";
const HOUR_MS = 60 * 60 * 1000;

function cleanup(authorization?: string) {
  const headers = new Headers();
  if (authorization) {
    headers.set("Authorization", authorization);
  }
  return app.request("/api/maintenance/cleanup", { method: "POST", headers });
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR_MS);
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await db.delete(verifications);
  await db.delete(users);
});

describe("POST /api/maintenance/cleanup", () => {
  test("合言葉を決めていない環境では 404", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await cleanup(`Bearer ${SECRET}`);
    expect(res.status).toBe(404);
  });

  test("合言葉がなければ 401", async () => {
    const res = await cleanup();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "unauthorized", message: "合言葉が正しくありません" },
    });
  });

  test("合言葉が違えば 401", async () => {
    const res = await cleanup("Bearer wrong-secret");
    expect(res.status).toBe(401);
  });

  test("期限切れのセッションと一時的な値を消す（ユーザーは消さない）", async () => {
    await db.insert(users).values([
      // 同意した日時がない（同意の確認画面があったころに登録した）→ 今は消さない
      {
        id: "legacy",
        name: "Legacy",
        email: "legacy@example.com",
        createdAt: hoursAgo(25),
      },
      // 登録して、同意した → 残す
      {
        id: "member",
        name: "Member",
        email: "member@example.com",
        createdAt: hoursAgo(100),
        termsAcceptedAt: hoursAgo(99),
      },
    ]);
    await db.insert(sessions).values([
      {
        id: "s-expired",
        token: "t-expired",
        userId: "member",
        expiresAt: hoursAgo(1),
        updatedAt: hoursAgo(2),
      },
      {
        id: "s-valid",
        token: "t-valid",
        userId: "member",
        expiresAt: new Date(Date.now() + HOUR_MS),
        updatedAt: hoursAgo(2),
      },
    ]);
    await db.insert(verifications).values([
      {
        id: "v-expired",
        identifier: "state",
        value: "x",
        expiresAt: hoursAgo(1),
      },
      {
        id: "v-valid",
        identifier: "state",
        value: "y",
        expiresAt: new Date(Date.now() + HOUR_MS),
      },
    ]);

    const res = await cleanup(`Bearer ${SECRET}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      deleted: { sessions: 1, verifications: 1 },
    });
    const remainingUsers = await db.select({ id: users.id }).from(users);
    expect(remainingUsers.map((u) => u.id).sort()).toEqual([
      "legacy",
      "member",
    ]);
    expect(
      await db.query.sessions.findFirst({ where: eq(sessions.id, "s-valid") }),
    ).toBeDefined();
    expect(
      await db.query.sessions.findFirst({
        where: eq(sessions.id, "s-expired"),
      }),
    ).toBeUndefined();
    const remainingVerifications = await db
      .select({ id: verifications.id })
      .from(verifications);
    expect(remainingVerifications).toEqual([{ id: "v-valid" }]);
  });
});
