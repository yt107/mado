import { localDateString } from "../widgets/countdown";
import { normalizeSettings } from "../widgets/settings";
import type { WidgetType } from "../widgets/types";
import type { DisplayTarget } from "./display-targets";
import type { BoardWidget } from "./schema";
import { TEMPLATES, type TemplateId } from "./templates";

// プレビュー（ログインの画面、テンプレートの選択）で見せる、見本の中身（画面設計の例と同じ）
function sampleContent(
  type: WidgetType,
): Partial<Pick<BoardWidget, "todoItems" | "memo" | "settings">> {
  const now = new Date();
  const shiftDays = (days: number) =>
    localDateString(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));
  switch (type) {
    case "todo":
      return {
        todoItems: [
          {
            id: "sample-1",
            title: "請求書を支払う",
            isDone: false,
            sortOrder: 0,
          },
          {
            id: "sample-2",
            title: "母に電話する",
            isDone: false,
            sortOrder: 1,
          },
          {
            id: "sample-3",
            title: "洗濯物を取り込む",
            isDone: true,
            sortOrder: 2,
          },
          {
            id: "sample-4",
            title: "加湿器のフィルター交換",
            isDone: false,
            sortOrder: 3,
          },
        ],
      };
    case "memo":
      return {
        memo: {
          body: "買い物：牛乳、卵、食パン\n図書館の本を8日までに返却\n年賀状の準備をはじめる",
          updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        },
      };
    case "countdown":
      return {
        settings: {
          title: "京都旅行",
          date: shiftDays(15),
          suffix: "出発",
          startDate: shiftDays(-5),
        },
      };
    default:
      return {};
  }
}

// テンプレートを、API が返すボードと同じ形にする（プレビューで、本物と同じ部品で描くため）。
// withSample なら、ToDo やメモに見本の中身を入れる
export function templateWidgets(
  templateId: TemplateId,
  { withSample = false }: { withSample?: boolean } = {},
): BoardWidget[] {
  return TEMPLATES[templateId].widgets.map((widget) => {
    const sample = withSample ? sampleContent(widget.type) : {};
    return {
      id: widget.type,
      type: widget.type,
      settings: normalizeSettings(widget.type, {
        ...widget.settings,
        ...sample.settings,
      }),
      placements: Object.entries(widget.placements).flatMap(
        ([target, placement]) =>
          placement
            ? [{ displayTarget: target as DisplayTarget, ...placement }]
            : [],
      ),
      ...(widget.type === "todo" && { todoItems: sample.todoItems ?? [] }),
      ...(widget.type === "memo" && { memo: sample.memo ?? null }),
    };
  });
}

// ウィジェットの大きさの分類（画面設計「サイズに応じた表示の切り替え」）
export type WidgetSize = "large" | "medium" | "small";

export function widgetSize(w: number, h: number): WidgetSize {
  if (w >= 2 && h >= 2) return "large";
  if (w >= 2) return "medium";
  return "small";
}
