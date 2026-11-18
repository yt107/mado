import * as z from "zod";

// 時計の設定（widgets.settings）と、時刻の表示に使う関数。
// サーバー（API のチェック、テンプレート）と画面の両方で使う

// 選べる都市。設定には都市の id だけを保存し、名前とタイムゾーンはここから引く
export const CITIES = {
  tokyo: { label: "東京", timeZone: "Asia/Tokyo" },
  seoul: { label: "ソウル", timeZone: "Asia/Seoul" },
  beijing: { label: "北京", timeZone: "Asia/Shanghai" },
  hong_kong: { label: "香港", timeZone: "Asia/Hong_Kong" },
  singapore: { label: "シンガポール", timeZone: "Asia/Singapore" },
  bangkok: { label: "バンコク", timeZone: "Asia/Bangkok" },
  delhi: { label: "デリー", timeZone: "Asia/Kolkata" },
  dubai: { label: "ドバイ", timeZone: "Asia/Dubai" },
  moscow: { label: "モスクワ", timeZone: "Europe/Moscow" },
  paris: { label: "パリ", timeZone: "Europe/Paris" },
  berlin: { label: "ベルリン", timeZone: "Europe/Berlin" },
  london: { label: "ロンドン", timeZone: "Europe/London" },
  new_york: { label: "ニューヨーク", timeZone: "America/New_York" },
  chicago: { label: "シカゴ", timeZone: "America/Chicago" },
  los_angeles: { label: "ロサンゼルス", timeZone: "America/Los_Angeles" },
  honolulu: { label: "ホノルル", timeZone: "Pacific/Honolulu" },
  sao_paulo: { label: "サンパウロ", timeZone: "America/Sao_Paulo" },
  sydney: { label: "シドニー", timeZone: "Australia/Sydney" },
  auckland: { label: "オークランド", timeZone: "Pacific/Auckland" },
} as const;

export type CityId = keyof typeof CITIES;

const cityIdSchema = z.enum(Object.keys(CITIES) as [CityId, ...CityId[]]);

// 設定がない項目は、ここの値になる（あとで項目を足しても、前のデータが読める）
export const clockSettingsSchema = z.object({
  // 24時間／12時間（午前・午後）
  hourCycle: z.enum(["24h", "12h"]).default("24h"),
  showSeconds: z.boolean().default(true),
  showDate: z.boolean().default(true),
  // 11月6日 金曜日／2026年11月6日 金曜日／2026/11/06(金)
  dateFormat: z
    .enum(["monthDayWeekday", "yearMonthDayWeekday", "numeric"])
    .default("monthDayWeekday"),
  // 細字／標準／太字
  textStyle: z.enum(["thin", "regular", "bold"]).default("thin"),
  // 基準のタイムゾーン（右上に出す都市）
  city: cityIdSchema.default("tokyo"),
  // 世界時計（最大4都市）
  worldClocks: z.array(cityIdSchema).max(4).default([]),
});

export type ClockSettings = z.infer<typeof clockSettingsSchema>;

// 保存された設定を読む。形が合わなければ、初期値で表示する（画面を止めないため）
export function readClockSettings(settings: unknown): ClockSettings {
  const result = clockSettingsSchema.safeParse(settings);
  return result.success ? result.data : clockSettingsSchema.parse({});
}

// 毎秒作り直さないように、書式は作ったものを使い回す
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = timeZone + JSON.stringify(options);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("ja-JP", { timeZone, ...options });
    formatters.set(key, f);
  }
  return f;
}

function part(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((p) => p.type === type)?.value ?? "";
}

export type TimeParts = {
  hours: string;
  minutes: string;
  seconds: string;
  // 12時間のときだけ「午前」「午後」が入る
  dayPeriod: string | null;
};

// 時・分・秒に分けて返す（数字の大きさを変えて並べるため）
export function getTimeParts(
  date: Date,
  timeZone: string,
  hourCycle: ClockSettings["hourCycle"],
): TimeParts {
  const parts = formatter(timeZone, {
    hour: hourCycle === "24h" ? "2-digit" : "numeric",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: hourCycle === "24h" ? "h23" : "h12",
  }).formatToParts(date);
  return {
    hours: part(parts, "hour"),
    minutes: part(parts, "minute"),
    seconds: part(parts, "second"),
    dayPeriod: hourCycle === "12h" ? part(parts, "dayPeriod") : null,
  };
}

// 世界時計などの短い時刻（20:30、午後8:30）
export function formatShortTime(
  date: Date,
  timeZone: string,
  hourCycle: ClockSettings["hourCycle"],
): string {
  const { hours, minutes, dayPeriod } = getTimeParts(date, timeZone, hourCycle);
  return `${dayPeriod ?? ""}${hours}:${minutes}`;
}

export function formatClockDate(
  date: Date,
  timeZone: string,
  dateFormat: ClockSettings["dateFormat"],
): string {
  if (dateFormat === "numeric") {
    const ymd = formatter(timeZone, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    const weekday = formatter(timeZone, { weekday: "short" }).format(date);
    return `${ymd}(${weekday})`;
  }
  const day = formatter(timeZone, {
    ...(dateFormat === "yearMonthDayWeekday" && { year: "numeric" }),
    month: "long",
    day: "numeric",
  }).format(date);
  const weekday = formatter(timeZone, { weekday: "long" }).format(date);
  return `${day} ${weekday}`;
}

// その日の日付（YYYY-MM-DD）。タイムゾーンをまたいだ日付の比べ方に使う
function calendarDay(date: Date, timeZone: string) {
  const parts = formatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Date.UTC(
    Number(part(parts, "year")),
    Number(part(parts, "month")) - 1,
    Number(part(parts, "day")),
  );
}

// 都市の時差（GMT+9 など）。夏時間で変わるので、その日の値を出す
export function gmtOffsetLabel(timeZone: string, date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const name = part(parts, "timeZoneName");
  // UTC と同じ時刻の都市は "GMT" だけになるので、+0 を付ける
  return name === "GMT" ? "GMT+0" : name;
}

// 世界時計の日付が、基準の都市から見て「前日」「今日」「翌日」のどれか
export function relativeDayLabel(
  date: Date,
  baseTimeZone: string,
  timeZone: string,
): string {
  const diff =
    (calendarDay(date, timeZone) - calendarDay(date, baseTimeZone)) /
    (24 * 60 * 60 * 1000);
  if (diff < 0) return "前日";
  if (diff > 0) return "翌日";
  return "今日";
}
