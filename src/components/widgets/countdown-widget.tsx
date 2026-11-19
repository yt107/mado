"use client";

import { Hourglass } from "lucide-react";

import type { BoardWidget } from "@/lib/board/schema";
import { useNow } from "@/lib/hooks/use-now";
import {
  countdownState,
  formatCountdownDate,
  readCountdownSettings,
} from "@/lib/widgets/countdown";

// カウントダウン。イベントまでの日数（と時間）、進み具合のバー、日付を出す
export function CountdownWidget({ widget }: { widget: BoardWidget }) {
  const settings = readCountdownSettings(widget.settings);
  // 日付の計算は端末の時刻を使うので、サーバーでは出さない
  const now = useNow();
  const state = now ? countdownState(now, settings) : null;

  return (
    <div className="flex h-full flex-col">
      <p className="flex items-center gap-[0.4em] text-ink-2">
        <Hourglass aria-hidden className="size-[1.05em] text-accent-ink" />
        <span className="truncate">
          {settings.title ? `${settings.title}まで` : "カウントダウン"}
        </span>
      </p>

      <div className="flex min-h-0 flex-1 items-end">
        {state?.kind === "upcoming" && (
          <p className="flex items-baseline gap-[0.15em] whitespace-nowrap">
            <Big>{state.days}</Big>
            <Unit>日</Unit>
            {settings.unit === "daysHours" && (
              <>
                <Big small>{state.hours}</Big>
                <Unit>時間</Unit>
              </>
            )}
          </p>
        )}
        {state?.kind === "today" && <Big>今日</Big>}
        {state?.kind === "past" && <Big>終了</Big>}
        {state?.kind === "unset" && (
          <p className="text-[0.9em] text-ink-3">日付を設定してください</p>
        )}
      </div>

      {state?.kind === "upcoming" && settings.showProgress && (
        <div
          role="progressbar"
          aria-label="イベントまでの進み具合"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.progress * 100)}
          className="mt-[0.9em] h-[0.3em] overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${state.progress * 100}%` }}
          />
        </div>
      )}

      {now && settings.date && (
        <p className="mt-[0.7em] truncate text-[0.85em] text-ink-3">
          {formatCountdownDate(settings.date)}
          {settings.suffix && ` ${settings.suffix}`}
        </p>
      )}
    </div>
  );
}

// 大きな数字。ウィジェットの大きさに収まるようにする
function Big({
  children,
  small = false,
}: {
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <span
      className="font-display leading-none font-extralight"
      style={{
        fontSize: small
          ? "min(calc(48px * var(--scale, 1)), 22cqb, 22cqi)"
          : "min(calc(86px * var(--scale, 1)), 38cqb, 42cqi)",
      }}
    >
      {children}
    </span>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span className="text-[1.3em] text-ink-2">{children}</span>;
}
