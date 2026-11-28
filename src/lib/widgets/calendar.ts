import * as z from "zod";

import { localDateString } from "./countdown";
import { refreshMinutesSchema } from "./refresh";

// カレンダーの設定（widgets.settings）、購読先と予定の形、月表示の計算。
// 予定は iCal をサーバーが読んで返す。今日・明日の判断は、端末の時刻で行う

export const CALENDAR_SUBSCRIPTIONS_MAX = 10;
export const CALENDAR_NAME_MAX = 50;
// 一度に取り出せる期間（月表示の6週間が入る長さ）
export const CALENDAR_RANGE_MAX_DAYS = 62;

// 予定の色（購読先ごと）。登録した順に、まだ使っていない色を選ぶ
export const CALENDAR_COLORS = {
  blue: "#5b8def",
  green: "#3fb76f",
  red: "#e5534b",
  purple: "#a371f7",
  orange: "#ee9a3a",
  teal: "#2bb3a8",
  pink: "#e86fa8",
  yellow: "#d4b22c",
} as const;

export type CalendarColor = keyof typeof CALENDAR_COLORS;

export const CALENDAR_COLOR_LABELS: Record<CalendarColor, string> = {
  blue: "青",
  green: "緑",
  red: "赤",
  purple: "紫",
  orange: "オレンジ",
  teal: "青緑",
  pink: "ピンク",
  yellow: "黄",
};

export const CALENDAR_COLOR_KEYS = Object.keys(
  CALENDAR_COLORS,
) as CalendarColor[];

export const calendarSettingsSchema = z.object({
  // 表示する内容
  showMonth: z.boolean().default(true),
  showToday: z.boolean().default(true),
  showTomorrow: z.boolean().default(true),
  weekStart: z.enum(["sunday", "monday"]).default("sunday"),
  refreshMinutes: refreshMinutesSchema(30),
});

export type CalendarSettings = z.infer<typeof calendarSettingsSchema>;

export function readCalendarSettings(settings: unknown): CalendarSettings {
  const result = calendarSettingsSchema.safeParse(settings);
  return result.success ? result.data : calendarSettingsSchema.parse({});
}

// 購読先（URL は返さない。docs/api.md）
export const calendarSubscriptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.enum(CALENDAR_COLOR_KEYS),
  lastFetchedAt: z.string().nullable(),
  lastError: z.string().nullable(),
});

export type CalendarSubscription = z.infer<typeof calendarSubscriptionSchema>;

export const calendarEventSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  title: z.string(),
  // 時刻のある予定は ISO 8601（UTC）。終日の予定は "YYYY-MM-DD"（end はその次の日）
  start: z.string(),
  end: z.string(),
  allDay: z.boolean(),
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;

// Google カレンダーの購読先。表示モードで押したときに、Google カレンダーを開くために使う。
// account は、開くときに選ぶ Google アカウント（分からなければ null）
export const googleCalendarSchema = z.object({
  subscriptionId: z.string(),
  account: z.string().nullable(),
});

export type GoogleCalendar = z.infer<typeof googleCalendarSchema>;

export const calendarEventsResponseSchema = z.object({
  subscriptions: z.array(calendarSubscriptionSchema),
  events: z.array(calendarEventSchema),
  googleCalendars: z.array(googleCalendarSchema),
});

export type CalendarEventsResponse = z.infer<
  typeof calendarEventsResponseSchema
>;

// 今ある購読先の予定だけを残す。購読先を消した直後の読み直しは、消す前の予定を返すことがある
// （削除の保存より先にサーバーに届いたとき）ので、ボードの購読先で絞る
export function eventsOfSubscriptions(
  events: CalendarEvent[],
  subscriptions: Pick<CalendarSubscription, "id">[],
): CalendarEvent[] {
  const ids = new Set(subscriptions.map((subscription) => subscription.id));
  return events.filter((event) => ids.has(event.subscriptionId));
}

const GOOGLE_CALENDAR_APP_URL = "https://calendar.google.com/calendar/r";

// iCal の URL が Google カレンダーのものなら、開くときに選ぶアカウントを返す。Google のものでなければ null。
// URL の形は https://calendar.google.com/calendar/ical/<カレンダーの ID>/private-<鍵>/basic.ics。
// メインのカレンダーの ID は、アカウントのメールアドレス。ほかのカレンダー（…@group.calendar.google.com）や
// 祝日のカレンダーの ID からは、アカウントが分からない
export function readGoogleCalendar(
  icalUrl: string,
): { account: string | null } | null {
  let url: URL;
  try {
    url = new URL(icalUrl);
  } catch {
    return null;
  }
  const isGoogle =
    url.protocol === "https:" &&
    (url.hostname === "calendar.google.com" ||
      url.hostname === "www.google.com");
  const encodedId = /^\/calendar\/ical\/([^/]+)\//.exec(url.pathname)?.[1];
  if (!isGoogle || !encodedId) return null;
  let id: string;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
    return { account: null };
  }
  const isAccount =
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(id) &&
    !id.toLowerCase().endsWith("calendar.google.com");
  return { account: isAccount ? id : null };
}

// 表示モードで押したときに開く Google カレンダーの URL。ボードにある購読先に Google のものがなければ null。
// アカウントが分かれば authuser で選ぶ（ブラウザで複数の Google アカウントにログインしていても、そのアカウントで開く）
export function googleCalendarOpenUrl(
  googleCalendars: GoogleCalendar[],
  subscriptions: Pick<CalendarSubscription, "id">[],
): string | null {
  // 消した直後の購読先は使わない（予定と同じく、ボードの購読先で絞る）
  const ids = new Set(subscriptions.map((subscription) => subscription.id));
  const current = googleCalendars.filter((calendar) =>
    ids.has(calendar.subscriptionId),
  );
  if (current.length === 0) return null;
  const account = current.find((calendar) => calendar.account)?.account;
  return account
    ? `${GOOGLE_CALENDAR_APP_URL}?authuser=${encodeURIComponent(account)}`
    : GOOGLE_CALENDAR_APP_URL;
}

const urlInput = z
  .string({ error: "URL を入力してください" })
  .trim()
  .min(1, "URL を入力してください")
  .max(2048, "URL が長すぎます");

export const createCalendarSubscriptionSchema = z.object({ url: urlInput });

export const calendarNameSchema = z
  .string({ error: "名前を入力してください" })
  .trim()
  .min(1, "名前を入力してください")
  .max(CALENDAR_NAME_MAX, `名前は${CALENDAR_NAME_MAX}文字までにしてください`);

export const updateCalendarSubscriptionSchema = z
  .object({
    name: calendarNameSchema.optional(),
    color: z
      .enum(CALENDAR_COLOR_KEYS, { error: "色が正しくありません" })
      .optional(),
  })
  .refine((value) => value.name !== undefined || value.color !== undefined, {
    error: "変える値がありません",
  });

const isoDate = z.iso.date("日付の形が正しくありません");

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(date: string) {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

// 予定を取り出す期間（from から to まで。どちらも端末の日付で、to の日も含む）
export const calendarEventsQuerySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((value) => value.from <= value.to, {
    error: "期間が正しくありません",
  })
  .refine(
    (value) =>
      dayNumber(value.to) - dayNumber(value.from) < CALENDAR_RANGE_MAX_DAYS,
    { error: `期間は${CALENDAR_RANGE_MAX_DAYS}日までにしてください` },
  );

// ---- ここから下は画面で使う計算（端末の時刻で考える） ----

function shiftDate(date: string, days: number) {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return localDateString(new Date(y, m - 1, d + days));
}

export type MonthCell = {
  date: string;
  day: number;
  inMonth: boolean;
  // 0 が日曜日、6 が土曜日
  weekday: number;
};

// 月表示のマス（前後の月の日も入れて、週ごとに並べる）
export function monthGrid(
  year: number,
  monthIndex: number,
  weekStart: CalendarSettings["weekStart"],
): MonthCell[] {
  const first = new Date(year, monthIndex, 1);
  const startOffset =
    (first.getDay() - (weekStart === "monday" ? 1 : 0) + 7) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const weeks = Math.ceil((startOffset + daysInMonth) / 7);
  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = new Date(year, monthIndex, 1 - startOffset + index);
    return {
      date: localDateString(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
      weekday: date.getDay(),
    };
  });
}

// 曜日の見出し（週の始まりに合わせて並べる）
export function weekdayLabels(weekStart: CalendarSettings["weekStart"]) {
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  return weekStart === "monday" ? [...labels.slice(1), labels[0]!] : labels;
}

// 予定を取り出す期間：今月の月表示のマス全部と、明日
export function calendarRange(
  now: Date,
  weekStart: CalendarSettings["weekStart"],
) {
  const cells = monthGrid(now.getFullYear(), now.getMonth(), weekStart);
  const tomorrow = shiftDate(localDateString(now), 1);
  const last = cells.at(-1)?.date ?? tomorrow;
  return {
    from: cells[0]?.date ?? localDateString(now),
    to: last > tomorrow ? last : tomorrow,
  };
}

function localDayBounds(date: string) {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return {
    start: new Date(y, m - 1, d).getTime(),
    end: new Date(y, m - 1, d + 1).getTime(),
  };
}

// その日（端末の日付）にかかる予定。終日の予定を先に、ほかは始まりの早い順
export function eventsOn(events: CalendarEvent[], date: string) {
  const { start, end } = localDayBounds(date);
  return events
    .filter((event) => {
      if (event.allDay) {
        return event.start <= date && date < event.end;
      }
      const from = new Date(event.start).getTime();
      const to = Math.max(new Date(event.end).getTime(), from + 1);
      return from < end && to > start;
    })
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start.localeCompare(b.start);
    });
}

const pad = (value: number) => String(value).padStart(2, "0");

function timeLabel(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 予定の時刻の表し方（「10:00 – 11:00」「終日」。前の日から続く予定は「〜 11:00」）
export function eventTimeLabel(event: CalendarEvent, date: string) {
  if (event.allDay) return "終日";
  const { start, end } = localDayBounds(date);
  const from = new Date(event.start);
  const to = new Date(event.end);
  const startsToday = from.getTime() >= start;
  const endsToday = to.getTime() <= end;
  if (startsToday && endsToday) {
    return from.getTime() === to.getTime()
      ? timeLabel(from)
      : `${timeLabel(from)} – ${timeLabel(to)}`;
  }
  if (startsToday) return `${timeLabel(from)} –`;
  if (endsToday) return `– ${timeLabel(to)}`;
  return "終日";
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 「11月6日(金)」
export function dayLabel(date: string) {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}月${d}日(${weekday})`;
}

export function tomorrowOf(date: string) {
  return shiftDate(date, 1);
}
