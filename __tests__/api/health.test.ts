// @vitest-environment node
import { describe, expect, test } from "vitest";
import app from "@/server/app";

describe("GET /api/health", () => {
  test("200 と { status: 'ok' } を返す", async () => {
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("存在しない API は 404 を返す", async () => {
    const res = await app.request("/api/nope");

    expect(res.status).toBe(404);
  });
});
