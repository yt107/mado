"use client";

import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";

// 1時間ごとに、ログインの期限を延ばす窓口を呼ぶ
const EVERY_MS = 60 * 60 * 1000;
// タブを切り替えたときなどに、続けて何度も呼ばないための間隔
const MIN_GAP_MS = 60 * 1000;

// 最後に呼んだ時刻。画面をまたいでも（開発中に effect が2回動いても）、続けて呼ばないように、ここで持つ
let lastCalledAt = 0;

// 表示用の端末がログアウトしないように、開いているあいだ、ときどき /api/auth/get-session を呼ぶ。
// Better Auth は、前に延ばしてから1日たっていれば、DB の期限と Cookie の期限を一緒に30日先まで延ばす。
// サーバー側（Server Components と API）では延ばさないので、延ばすのはここだけ（src/server/auth.ts）
export function useSessionKeepAlive() {
  useEffect(() => {
    function keepAlive() {
      const now = Date.now();
      if (now - lastCalledAt < MIN_GAP_MS) {
        return;
      }
      lastCalledAt = now;
      // 通信に失敗しても、次の機会にまた呼ぶので、ここでは何もしない
      authClient.getSession().catch(() => {});
    }

    function onVisible() {
      if (document.visibilityState === "visible") {
        keepAlive();
      }
    }

    keepAlive();
    const timer = setInterval(keepAlive, EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
