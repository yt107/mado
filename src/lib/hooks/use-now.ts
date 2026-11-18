"use client";

import { useSyncExternalStore } from "react";

// 今の時刻を、1秒ごとに配る。時計がいくつあっても、タイマーは1つだけ使う

let nowSeconds = Math.floor(Date.now() / 1000);
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function tick() {
  const now = Date.now();
  nowSeconds = Math.floor(now / 1000);
  listeners.forEach((listener) => listener());
  // 次の秒の変わり目に合わせて呼ぶ（ずれがたまらないように）
  timer = setTimeout(tick, 1000 - (now % 1000));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

// サーバーでは時刻を出さない（サーバーとブラウザで時刻がずれて、表示が食い違うため）
export function useNow(): Date | null {
  const seconds = useSyncExternalStore(
    subscribe,
    () => nowSeconds,
    () => null,
  );
  return seconds === null ? null : new Date(seconds * 1000);
}
