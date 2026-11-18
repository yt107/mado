"use client";

import { MapPin } from "lucide-react";
import { useMemo } from "react";

import type { WidgetSize } from "@/lib/board/sample";
import { cx } from "@/lib/cx";
import { useNow } from "@/lib/hooks/use-now";
import {
  CITIES,
  formatClockDate,
  formatShortTime,
  getTimeParts,
  readClockSettings,
  relativeDayLabel,
} from "@/lib/widgets/clock";

const WEIGHTS = {
  thin: "font-extralight",
  regular: "font-normal",
  bold: "font-semibold",
} as const;

type Props = {
  settings: Record<string, unknown>;
  size: WidgetSize;
};

// 時計。大（2×2以上）は日付・時刻・世界時計、中（2×1）は日付・時刻、小（1×1）は時刻だけ
export function ClockWidget({ settings, size }: Props) {
  const s = useMemo(() => readClockSettings(settings), [settings]);
  const now = useNow();
  const city = CITIES[s.city];

  const time = now ? getTimeParts(now, city.timeZone, s.hourCycle) : null;
  const showHeader = size !== "small";
  const worldClocks = size === "large" ? s.worldClocks : [];

  // 数字が横に収まる大きさ。秒や「午前」を並べるときは、そのぶん小さくする
  const widthInEm =
    2.3 + (s.showSeconds ? 0.4 : 0) + (s.hourCycle === "12h" ? 0.6 : 0);

  return (
    <div className="flex h-full flex-col">
      {showHeader && (
        <div className="flex items-start justify-between gap-[1em]">
          <p className="text-[1.33em] text-ink-2">
            {s.showDate && now
              ? formatClockDate(now, city.timeZone, s.dateFormat)
              : null}
          </p>
          <p className="flex shrink-0 items-center gap-[0.3em] text-ink-3">
            <MapPin aria-hidden className="size-[1em]" />
            {city.label}
          </p>
        </div>
      )}

      {/* 時刻。この箱の大きさに合わせて数字の大きさを決める */}
      <div className="flex min-h-0 flex-1 items-center [container-type:size]">
        <p
          className={cx(
            "font-display leading-none whitespace-nowrap",
            WEIGHTS[s.textStyle],
          )}
          style={{
            fontSize: `min(calc(145px * var(--scale, 1)), ${(96 / widthInEm).toFixed(1)}cqi, 80cqb)`,
          }}
        >
          {time ? (
            <time dateTime={now?.toISOString()}>
              {time.dayPeriod && (
                <span className="mr-[0.15em] align-baseline text-[0.23em] text-ink-2">
                  {time.dayPeriod}
                </span>
              )}
              {time.hours}:{time.minutes}
              {s.showSeconds && (
                <span className="ml-[0.08em] align-baseline text-[0.23em] text-accent-ink tabular-nums">
                  {time.seconds}
                </span>
              )}
            </time>
          ) : (
            // サーバーでは時刻を出さず、場所だけとっておく
            <span className="invisible">00:00</span>
          )}
        </p>
      </div>

      {worldClocks.length > 0 && (
        <ul
          className="grid gap-[1em] border-t border-line pt-[1.2em]"
          style={{
            gridTemplateColumns: `repeat(${worldClocks.length}, minmax(0, 1fr))`,
          }}
        >
          {worldClocks.map((id) => {
            const other = CITIES[id];
            return (
              <li key={id} className="min-w-0">
                <p className="truncate text-[0.85em] text-ink-3">
                  {other.label}
                </p>
                <p className="mt-[0.2em] whitespace-nowrap">
                  <span className="font-display text-[1.45em]">
                    {now
                      ? formatShortTime(now, other.timeZone, s.hourCycle)
                      : "--:--"}
                  </span>
                  {now && (
                    <span className="ml-[0.5em] text-[0.7em] text-ink-3">
                      {relativeDayLabel(now, city.timeZone, other.timeZone)}
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
