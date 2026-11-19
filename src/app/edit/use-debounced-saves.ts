"use client";

import { useCallback, useEffect, useRef } from "react";

const DELAY_MS = 600;

// 文字を打っているあいだの保存は、打ち終わるまで少し待ってから送る（打つたびに送らない）。
// 同じ key の保存は、新しいもので置きかえる
export function useDebouncedSaves() {
  const pending = useRef(
    new Map<
      string,
      { timer: ReturnType<typeof setTimeout>; run: () => void }
    >(),
  );

  const schedule = useCallback((key: string, run: () => void) => {
    const current = pending.current.get(key);
    if (current) clearTimeout(current.timer);
    const timer = setTimeout(() => {
      pending.current.delete(key);
      run();
    }, DELAY_MS);
    pending.current.set(key, { timer, run });
  }, []);

  // 待っている保存を捨てる（新しい値を、すぐに送るとき）
  const cancel = useCallback((key: string) => {
    const current = pending.current.get(key);
    if (current) clearTimeout(current.timer);
    pending.current.delete(key);
  }, []);

  // 待っている保存を、今すぐ送る（パネルを閉じたとき、画面を離れるとき）
  const flush = useCallback(() => {
    for (const [key, current] of pending.current) {
      clearTimeout(current.timer);
      pending.current.delete(key);
      current.run();
    }
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return { schedule, cancel, flush };
}
