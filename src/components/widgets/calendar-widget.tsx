"use client";

import { CalendarDays } from "lucide-react";

import { api } from "@/lib/api-client";
import { sampleCalendar } from "@/lib/board/sample-remote";
import type { BoardWidget } from "@/lib/board/schema";
import { cx } from "@/lib/cx";
import { useNow } from "@/lib/hooks/use-now";
import { useRemoteData, type RemoteData } from "@/lib/hooks/use-remote-data";
import {
  CALENDAR_COLORS,
  calendarRange,
  dayLabel,
  eventsOfSubscriptions,
  eventsOn,
  eventTimeLabel,
  googleCalendarOpenUrl,
  monthGrid,
  readCalendarSettings,
  tomorrowOf,
  weekdayLabels,
  type CalendarEvent,
  type CalendarEventsResponse,
  type CalendarSettings,
} from "@/lib/widgets/calendar";
import { localDateString } from "@/lib/widgets/countdown";

import { RemoteStatus } from "./remote-status";
import { useSampleMode } from "./sample-mode";

type Size = { w: number; h: number };

// カレンダー（画面設計「ウィジェット一覧」のカレンダー）。月表示と、今日・明日の予定。
// 予定は、サーバーが iCal を読んで返す（/api/widgets/:widgetId/calendar-events）
export function CalendarWidget({
  widget,
  size,
  openLink = false,
}: {
  widget: BoardWidget;
  size: Size;
  // 表示モード。Google カレンダーを登録していれば、押すと Google カレンダーを開く
  openLink?: boolean;
}) {
  const settings = readCalendarSettings(widget.settings);
  const now = useNow();
  const sample = useSampleMode();
  if (!now) return null;
  return sample ? (
    <CalendarView
      settings={settings}
      data={sampleCalendar(now)}
      now={now}
      size={size}
    />
  ) : (
    <LiveCalendar
      widget={widget}
      settings={settings}
      now={now}
      size={size}
      openLink={openLink}
    />
  );
}

async function loadEvents(
  widgetId: string,
  from: string,
  to: string,
): Promise<CalendarEventsResponse> {
  const res = await api.widgets[":widgetId"]["calendar-events"].$get({
    param: { widgetId },
    query: { from, to },
  });
  if (!res.ok) {
    throw new Error("予定を読み込めませんでした");
  }
  return res.json();
}

function LiveCalendar({
  widget,
  settings,
  now,
  size,
  openLink,
}: {
  widget: BoardWidget;
  settings: CalendarSettings;
  now: Date;
  size: Size;
  openLink: boolean;
}) {
  const subscriptions = widget.calendarSubscriptions ?? [];
  const { from, to } = calendarRange(now, settings.weekStart);
  // 購読先や期間（日付が変わった、週の始まりを変えた）が変わったら、すぐ読み直す
  const key =
    subscriptions.length > 0
      ? `${from}:${to}:${subscriptions.map((s) => s.id).join(",")}`
      : null;
  const state = useRemoteData(
    key,
    () => loadEvents(widget.id, from, to),
    settings.refreshMinutes * 60_000,
  );

  if (subscriptions.length === 0) {
    return (
      <CalendarView
        settings={settings}
        data={{ subscriptions: [], events: [] }}
        now={now}
        size={size}
        empty="カレンダーが未登録です。編集モードで iCal の URL を登録してください"
      />
    );
  }
  return (
    <CalendarView
      settings={settings}
      // 名前と色は、ボードの値（編集ですぐ変わる）を使う。
      // 予定も、ボードにある購読先のものだけを出す（消した購読先の予定が残らないように）
      data={{
        subscriptions,
        events: eventsOfSubscriptions(state.data?.events ?? [], subscriptions),
      }}
      now={now}
      size={size}
      state={state}
      openUrl={
        openLink
          ? googleCalendarOpenUrl(
              state.data?.googleCalendars ?? [],
              subscriptions,
            )
          : null
      }
    />
  );
}

type ViewProps = {
  settings: CalendarSettings;
  data: Pick<CalendarEventsResponse, "subscriptions" | "events">;
  now: Date;
  size: Size;
  state?: RemoteData<CalendarEventsResponse>;
  empty?: string;
  // 押したときに開く URL（表示モードで、Google カレンダーを登録しているときだけ）
  openUrl?: string | null;
};

export function CalendarView({
  settings,
  data,
  now,
  size,
  state,
  empty,
  openUrl,
}: ViewProps) {
  const today = localDateString(now);
  const tomorrow = tomorrowOf(today);
  const colors = new Map(
    data.subscriptions.map((s) => [s.id, CALENDAR_COLORS[s.color]]),
  );
  // 1×1 は今日の予定だけ。横に広ければ、月表示と予定を左右に並べる
  const showMonth = settings.showMonth && size.h >= 2;
  const side = showMonth && size.w >= 2;
  const days = [
    settings.showToday && { label: "今日", date: today },
    settings.showTomorrow && size.h >= 2 && { label: "明日", date: tomorrow },
  ].filter((day): day is { label: string; date: string } => !!day);

  const lists = (
    <div className="flex min-h-0 flex-1 flex-col gap-[1em] overflow-hidden">
      {empty ? (
        <p className="text-[0.9em] leading-relaxed text-ink-3">{empty}</p>
      ) : state?.loading ? (
        <p className="text-[0.9em] text-ink-3">読み込み中…</p>
      ) : (
        days.map(({ label, date }) => (
          <DayEvents
            key={date}
            label={label}
            date={date}
            events={eventsOn(data.events, date)}
            colors={colors}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="relative flex h-full flex-col">
      {(!showMonth || state?.error) && (
        <div className="mb-[0.8em] flex items-center justify-between gap-[0.5em]">
          {!showMonth ? (
            <p className="flex items-center gap-[0.4em] font-bold">
              <CalendarDays aria-hidden className="size-[1.05em]" />
              カレンダー
            </p>
          ) : (
            <span />
          )}
          {state?.error && state.updatedAt && <RemoteStatus state={state} />}
        </div>
      )}
      {state?.error && !state.updatedAt && (
        <p className="mb-[0.6em] text-[0.85em] text-danger">
          予定を読み込めませんでした
        </p>
      )}
      <div
        className={cx(
          "flex min-h-0 flex-1",
          side ? "flex-row gap-[1.4em]" : "flex-col",
        )}
      >
        {showMonth && (
          <MonthView
            now={now}
            settings={settings}
            events={data.events}
            className={side ? "w-1/2 shrink-0" : undefined}
          />
        )}
        {showMonth && !side && days.length > 0 && (
          <hr className="my-[1em] border-line" />
        )}
        {lists}
      </div>
      {openUrl && (
        // ウィジェットのどこを押しても開くよう、余白（28px × 拡大率）の分も広げて、カード全体を覆う
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute -inset-[calc(28px*var(--scale,1))] rounded-[calc(19px*var(--scale,1))] focus-visible:-outline-offset-2"
        >
          <span className="sr-only">
            Google カレンダーを開く（新しいタブで開く）
          </span>
        </a>
      )}
    </div>
  );
}

function MonthView({
  now,
  settings,
  events,
  className,
}: {
  now: Date;
  settings: CalendarSettings;
  events: CalendarEvent[];
  className?: string;
}) {
  const today = localDateString(now);
  const cells = monthGrid(
    now.getFullYear(),
    now.getMonth(),
    settings.weekStart,
  );
  const busy = new Set(
    cells
      .filter((cell) => eventsOn(events, cell.date).length > 0)
      .map((cell) => cell.date),
  );
  return (
    <div className={className}>
      <p className="flex items-baseline gap-[0.5em]">
        <span className="text-[1.5em] font-bold">{now.getMonth() + 1}月</span>
        <span className="text-ink-3">{now.getFullYear()}</span>
      </p>
      <div
        role="grid"
        aria-label={`${now.getFullYear()}年${now.getMonth() + 1}月`}
        className="mt-[0.8em] grid grid-cols-7 gap-y-[0.15em] text-center"
      >
        {weekdayLabels(settings.weekStart).map((label) => (
          <span
            key={label}
            role="columnheader"
            className={cx(
              "pb-[0.3em] text-[0.75em]",
              label === "日"
                ? "text-[#e5534b] dark:text-[#f07a73]"
                : label === "土"
                  ? "text-[#4c7fe0] dark:text-[#6ea0ff]"
                  : "text-ink-3",
            )}
          >
            {label}
          </span>
        ))}
        {cells.map((cell) => {
          const isToday = cell.date === today;
          return (
            <span
              key={cell.date}
              role="gridcell"
              aria-current={isToday ? "date" : undefined}
              className="flex flex-col items-center"
            >
              <span
                className={cx(
                  "grid size-[1.85em] place-items-center rounded-full text-[0.9em]",
                  isToday
                    ? "bg-accent font-bold text-on-accent"
                    : !cell.inMonth
                      ? "text-ink-3/50"
                      : cell.weekday === 0
                        ? "text-[#e5534b] dark:text-[#f07a73]"
                        : cell.weekday === 6
                          ? "text-[#4c7fe0] dark:text-[#6ea0ff]"
                          : "",
                )}
              >
                {cell.day}
              </span>
              <span
                aria-hidden
                className={cx(
                  "size-[0.28em] rounded-full",
                  busy.has(cell.date) && !isToday
                    ? "bg-ink-3"
                    : "bg-transparent",
                )}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DayEvents({
  label,
  date,
  events,
  colors,
}: {
  label: string;
  date: string;
  events: CalendarEvent[];
  colors: Map<string, string>;
}) {
  return (
    <section>
      <h3 className="flex items-baseline justify-between gap-[0.5em] font-bold">
        <span className="truncate">
          {label}・{dayLabel(date)}
        </span>
        <span className="shrink-0 text-[0.85em] font-normal text-ink-3">
          {events.length}件
        </span>
      </h3>
      {events.length === 0 ? (
        <p className="mt-[0.5em] text-[0.85em] text-ink-3">予定はありません</p>
      ) : (
        <ul className="mt-[0.6em] flex flex-col gap-[0.7em]">
          {events.map((event) => (
            <li key={event.id} className="flex gap-[0.6em]">
              <span
                aria-hidden
                className="w-[0.22em] shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    colors.get(event.subscriptionId) ?? "#8a8e97",
                }}
              />
              <span className="min-w-0">
                <span className="block truncate">{event.title}</span>
                <span className="block text-[0.8em] text-ink-3">
                  {eventTimeLabel(event, date)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
