"use client";

import { CloudOff, LoaderCircle, RefreshCw } from "lucide-react";

import { cx } from "@/lib/cx";
import type { RemoteData } from "@/lib/hooks/use-remote-data";
import { formatClockTime } from "@/lib/widgets/refresh";

// 外から読むウィジェットの、右上の小さな状態（画面設計「ニュース・RSS（状態別）」）。
// 読み込み中／「10:28 更新」／読み直せなかったときは「更新に失敗・9:40 時点」
export function RemoteStatus({
  state,
  className,
}: {
  state: Pick<RemoteData<unknown>, "loading" | "error" | "updatedAt">;
  className?: string;
}) {
  if (state.loading) {
    return (
      <span
        className={cx(
          "flex shrink-0 items-center gap-[0.3em] text-[0.8em] opacity-60",
          className,
        )}
      >
        <LoaderCircle aria-hidden className="size-[1em] animate-spin" />
        読み込み中…
      </span>
    );
  }
  if (state.error && state.updatedAt) {
    return (
      <span
        className={cx(
          "flex shrink-0 items-center gap-[0.3em] rounded-[0.4em] bg-accent/15 px-[0.5em] py-[0.15em] text-[0.8em] text-accent-ink",
          className,
        )}
      >
        <CloudOff aria-hidden className="size-[1em]" />
        更新に失敗・{formatClockTime(state.updatedAt)} 時点
      </span>
    );
  }
  if (state.updatedAt) {
    return (
      <span
        className={cx(
          "flex shrink-0 items-center gap-[0.3em] text-[0.8em] opacity-60",
          className,
        )}
      >
        <RefreshCw aria-hidden className="size-[0.9em]" />
        {formatClockTime(state.updatedAt)} 更新
      </span>
    );
  }
  return null;
}
