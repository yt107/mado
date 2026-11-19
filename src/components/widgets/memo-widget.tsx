"use client";

import { StickyNote } from "lucide-react";

import type { BoardWidget } from "@/lib/board/schema";
import { cx } from "@/lib/cx";
import { useNow } from "@/lib/hooks/use-now";
import { readMemoSettings, relativeTimeLabel } from "@/lib/widgets/memo";

const FONT_SIZES = {
  small: "text-[0.95em]",
  medium: "text-[1.1em]",
  large: "text-[1.4em]",
} as const;

// メモ。本文は全部出し、入りきらない行は下を切る（1×1 は入る行数まで）
export function MemoWidget({ widget }: { widget: BoardWidget }) {
  const settings = readMemoSettings(widget.settings);
  const now = useNow();
  const memo = widget.memo ?? null;
  const dark = settings.color === "dark";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-[0.5em]">
        <p
          className={cx(
            "flex items-center gap-[0.4em] font-bold",
            dark ? "text-ink-2" : "opacity-70",
          )}
        >
          <StickyNote aria-hidden className="size-[1.05em]" />
          メモ
        </p>
        {memo && now && (
          <p className={cx("text-[0.8em]", dark ? "text-ink-3" : "opacity-60")}>
            {relativeTimeLabel(new Date(memo.updatedAt), now)}
          </p>
        )}
      </div>
      {memo?.body ? (
        <p
          className={cx(
            "mt-[0.7em] min-h-0 flex-1 overflow-hidden leading-[1.7] break-words whitespace-pre-wrap",
            FONT_SIZES[settings.fontSize],
          )}
        >
          {memo.body}
        </p>
      ) : (
        <p className="mt-[0.7em] text-[0.9em] opacity-60">
          メモがまだありません
        </p>
      )}
    </div>
  );
}
