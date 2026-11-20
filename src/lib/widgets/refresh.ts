import * as z from "zod";

// 外からデータを読むウィジェット（天気・カレンダー・ニュース）の、更新間隔（分）
export const REFRESH_MINUTES = [15, 30, 60] as const;

export type RefreshMinutes = (typeof REFRESH_MINUTES)[number];

export function refreshMinutesSchema(defaultValue: RefreshMinutes) {
  return z
    .literal(REFRESH_MINUTES, { error: "更新間隔が正しくありません" })
    .default(defaultValue);
}

export function refreshLabel(minutes: RefreshMinutes) {
  return minutes === 60 ? "1時間ごと" : `${minutes}分ごと`;
}

// 「10:28 更新」の時刻（端末の時刻で出す）
export function formatClockTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}
