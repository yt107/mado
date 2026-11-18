import { normalizeSettings } from "../widgets/settings";
import type { DisplayTarget } from "./display-targets";
import type { BoardWidget } from "./schema";
import { TEMPLATES, type TemplateId } from "./templates";

// テンプレートを、API が返すボードと同じ形にする（プレビューで、本物と同じ部品で描くため）
export function templateWidgets(templateId: TemplateId): BoardWidget[] {
  return TEMPLATES[templateId].widgets.map((widget) => ({
    id: widget.type,
    type: widget.type,
    settings: normalizeSettings(widget.type, widget.settings),
    placements: Object.entries(widget.placements).flatMap(
      ([target, placement]) =>
        placement
          ? [{ displayTarget: target as DisplayTarget, ...placement }]
          : [],
    ),
  }));
}

// ウィジェットの大きさの分類（画面設計「サイズに応じた表示の切り替え」）
export type WidgetSize = "large" | "medium" | "small";

export function widgetSize(w: number, h: number): WidgetSize {
  if (w >= 2 && h >= 2) return "large";
  if (w >= 2) return "medium";
  return "small";
}
