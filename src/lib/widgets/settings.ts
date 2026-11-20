import type * as z from "zod";

import { calendarSettingsSchema } from "./calendar";
import { clockSettingsSchema } from "./clock";
import { countdownSettingsSchema } from "./countdown";
import { memoSettingsSchema } from "./memo";
import { newsSettingsSchema } from "./news";
import { todoSettingsSchema } from "./todo";
import type { WidgetType } from "./types";
import { weatherSettingsSchema } from "./weather";

// 種類ごとの設定のスキーマ
export const SETTINGS_SCHEMAS: Partial<Record<WidgetType, z.ZodType>> = {
  clock: clockSettingsSchema,
  weather: weatherSettingsSchema,
  calendar: calendarSettingsSchema,
  todo: todoSettingsSchema,
  memo: memoSettingsSchema,
  countdown: countdownSettingsSchema,
  news: newsSettingsSchema,
};

// ウィジェットの設定を、種類ごとのスキーマで読み、足りない項目を初期値で埋める。
// スキーマがない種類は、そのまま返す
export function normalizeSettings(
  type: WidgetType,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const schema = SETTINGS_SCHEMAS[type];
  return schema
    ? (schema.parse(settings) as Record<string, unknown>)
    : settings;
}
