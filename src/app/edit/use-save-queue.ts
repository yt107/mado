"use client";

import { useCallback, useRef, useState } from "react";

export type SaveStatus = "saved" | "saving" | "failed";

type Options = {
  // ログインが切れていたとき
  onUnauthorized: () => void;
  // 保存できなかったとき（画面をサーバーの状態に戻す）
  onFailed: () => Promise<void>;
};

// 自動保存。操作のたびに送るが、送る順番がずれないように、1つずつ順に送る
export function useSaveQueue({ onUnauthorized, onFailed }: Options) {
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);

  const run = useCallback(
    (task: () => Promise<{ ok: boolean; status: number }>) => {
      setPending((n) => n + 1);
      setFailed(false);
      queue.current = queue.current.then(async () => {
        try {
          const res = await task();
          if (res.status === 401) {
            onUnauthorized();
          } else if (!res.ok) {
            setFailed(true);
            await onFailed();
          }
        } catch {
          // 通信が切れたときなど
          setFailed(true);
          await onFailed();
        } finally {
          setPending((n) => n - 1);
        }
      });
    },
    [onUnauthorized, onFailed],
  );

  const status: SaveStatus =
    pending > 0 ? "saving" : failed ? "failed" : "saved";
  return { run, status };
}
