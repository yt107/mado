import { afterEach, describe, expect, test } from "vitest";

import { isEmbeddedBrowser } from "@/lib/browser-support";
import {
  saveWithdrawIntent,
  takeWithdrawIntent,
  WITHDRAW_INTENT_TTL_MS,
} from "@/lib/withdraw-intent";

describe("isEmbeddedBrowser（Google のログインが使えないブラウザ）", () => {
  test.each([
    [
      "LINE（iPhone）",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.16.0",
    ],
    [
      "Instagram（iPhone）",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0",
    ],
    [
      "Facebook（Android）",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]",
    ],
    [
      "Android の WebView（キオスク用のアプリなど）",
      "Mozilla/5.0 (Linux; Android 13; SM-X200 Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Safari/537.36",
    ],
  ])("%s は使えない", (_name, userAgent) => {
    expect(isEmbeddedBrowser(userAgent)).toBe(true);
  });

  test.each([
    [
      "Safari（iPhone）",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    ],
    [
      "Chrome（Android）",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    ],
    [
      "Chrome（Mac）",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    ],
    [
      "Safari（iPad）",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    ],
  ])("%s は使える", (_name, userAgent) => {
    expect(isEmbeddedBrowser(userAgent)).toBe(false);
  });
});

describe("退会の手続きの記録", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  test("保存した手続きを、1回だけ読める", () => {
    expect(saveWithdrawIntent("user_1", 1000)).toBe(true);
    expect(takeWithdrawIntent(2000)).toEqual({
      userId: "user_1",
      startedAt: 1000,
    });
    expect(takeWithdrawIntent(2000)).toBeNull();
  });

  test("15分をすぎた手続きは無効", () => {
    saveWithdrawIntent("user_1", 0);
    expect(takeWithdrawIntent(WITHDRAW_INTENT_TTL_MS + 1)).toBeNull();
  });

  test("壊れた値は無視する", () => {
    sessionStorage.setItem("mado:withdraw-intent", "{broken");
    expect(takeWithdrawIntent()).toBeNull();
  });
});
