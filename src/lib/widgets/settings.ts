import { clockSettingsSchema } from "./clock";
import type { WidgetType } from "./types";

// ウィジェットの設定を、種類ごとのスキーマで読み、足りない項目を初期値で埋める。
// まだスキーマがない種類（まとまり3・4で作る）は、そのまま返す
export function normalizeSettings(
  type: WidgetType,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  switch (type) {
    case "clock":
      return clockSettingsSchema.parse(settings);
    default:
      return settings;
  }
}
