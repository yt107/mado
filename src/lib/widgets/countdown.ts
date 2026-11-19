import * as z from "zod";

// カウントダウンの設定（widgets.settings）と、残りの日数の計算。
// 日付はカレンダーの日だけを持つので、時刻のない "YYYY-MM-DD" で保存する（docs/er.md の日時の決まり）

export const COUNTDOWN_TITLE_MAX = 30;
export const COUNTDOWN_SUFFIX_MAX = 10;

const isoDate = z.iso.date("日付の形が正しくありません");

export const countdownSettingsSchema = z.object({
  // イベント名（「京都旅行」なら、見出しは「京都旅行まで」）
  title: z
    .string()
    .max(
      COUNTDOWN_TITLE_MAX,
      `イベント名は${COUNTDOWN_TITLE_MAX}文字までにしてください`,
    )
    .default(""),
  date: isoDate.nullable().default(null),
  // 日付のあとに出す言葉（「出発」など）
  suffix: z
    .string()
    .max(
      COUNTDOWN_SUFFIX_MAX,
      `日付のあとの言葉は${COUNTDOWN_SUFFIX_MAX}文字までにしてください`,
    )
    .default(""),
  // 日数だけ／日数と時間
  unit: z.enum(["days", "daysHours"]).default("days"),
  showProgress: z.boolean().default(true),
  // 進み具合のバーの始まり（日付を設定した日）
  startDate: isoDate.nullable().default(null),
});

export type CountdownSettings = z.infer<typeof countdownSettingsSchema>;

export function readCountdownSettings(settings: unknown): CountdownSettings {
  const result = countdownSettingsSchema.safeParse(settings);
  return result.success ? result.data : countdownSettingsSchema.parse({});
}

const DAY_MS = 24 * 60 * 60 * 1000;

// 端末の時刻での、今日の日付（YYYY-MM-DD）
export function localDateString(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayNumber(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export type CountdownState =
  | { kind: "unset" }
  | { kind: "upcoming"; days: number; hours: number; progress: number }
  | { kind: "today" }
  | { kind: "past" };

// 今の時刻から、残りの日数（と時間）、進み具合を出す。日付は端末の時刻で数える
export function countdownState(
  now: Date,
  settings: CountdownSettings,
): CountdownState {
  if (!settings.date) return { kind: "unset" };
  const today = dayNumber(localDateString(now));
  const target = dayNumber(settings.date);
  const days = target - today;
  if (days === 0) return { kind: "today" };
  if (days < 0) return { kind: "past" };

  // 日数と時間：その日の 0時（端末の時刻）までの残り
  const [y = 0, m = 1, d = 1] = settings.date.split("-").map(Number);
  const msLeft = new Date(y, m - 1, d).getTime() - now.getTime();
  const hours = Math.max(0, Math.floor(msLeft / (60 * 60 * 1000)) % 24);

  // 進み具合：日付を設定した日から、当日まで
  const start = settings.startDate ? dayNumber(settings.startDate) : today;
  const total = target - start;
  const progress =
    total <= 0 ? 1 : Math.min(Math.max((today - start) / total, 0), 1);

  return {
    kind: "upcoming",
    days: hours > 0 && settings.unit === "daysHours" ? days - 1 : days,
    hours,
    progress,
  };
}

// 「11月21日(土)」
export function formatCountdownDate(date: string): string {
  const time = dayNumber(date) * DAY_MS;
  const day = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
  }).format(time);
  const weekday = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "UTC",
    weekday: "short",
  }).format(time);
  return `${day}(${weekday})`;
}
