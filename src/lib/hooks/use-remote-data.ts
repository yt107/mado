"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

// 外から読むデータ（天気・予定・ニュース）を、決めた間隔で読み直す。
// - 読み直しに失敗しても、前に読めた内容はそのまま見せる（画面設計「更新に失敗」）
// - key が変わったら（地域やフィードを変えたら）、すぐに読み直す
// - 画面が裏にあるあいだは読まず、前に戻ったときに古ければ読み直す

export type RemoteData<T> = {
  data: T | null;
  // 最後に読めなかったときの理由（最後に読めたなら null）
  error: string | null;
  // 最後に読めた時刻
  updatedAt: Date | null;
  // まだ一度も読めておらず、読んでいるところ
  loading: boolean;
};

type Stored<T> = {
  key: string;
  data: T | null;
  error: string | null;
  updatedAt: number | null;
};

function messageOf(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "読み込めませんでした";
}

export function useRemoteData<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
): RemoteData<T> {
  const [stored, setStored] = useState<Stored<T> | null>(null);
  const lastRun = useRef(0);
  const run = useEffectEvent(load);

  useEffect(() => {
    if (key === null) return;
    let controller: AbortController | null = null;
    let active = true;

    async function refresh() {
      if (key === null) return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      lastRun.current = Date.now();
      try {
        const data = await run(current.signal);
        if (!active || current.signal.aborted) return;
        setStored({ key, data, error: null, updatedAt: Date.now() });
      } catch (error) {
        if (!active || current.signal.aborted) return;
        // 前に読めた内容は残す
        setStored((previous) =>
          previous?.key === key
            ? { ...previous, error: messageOf(error) }
            : { key, data: null, error: messageOf(error), updatedAt: null },
        );
      }
    }

    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, intervalMs);
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRun.current >= intervalMs
      ) {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, intervalMs]);

  const current = key !== null && stored?.key === key ? stored : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    updatedAt: current?.updatedAt ? new Date(current.updatedAt) : null,
    loading: key !== null && current === null,
  };
}
