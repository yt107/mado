import type * as z from "zod";

import { clockSettingsSchema } from "./clock";
import { countdownSettingsSchema } from "./countdown";
import { memoSettingsSchema } from "./memo";
import { todoSettingsSchema } from "./todo";
import type { WidgetType } from "./types";

// 種類ごとの設定のスキーマ。まだ設定を作っていない種類（まとまり4で作る）は載せない
export const SETTINGS_SCHEMAS: Partial<Record<WidgetType, z.ZodType>> = {
  clock: clockSettingsSchema,
  todo: todoSettingsSchema,
  memo: memoSettingsSchema,
  countdown: countdownSettingsSchema,
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
