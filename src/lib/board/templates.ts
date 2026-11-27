import type { DisplayTarget } from "./display-targets";
import type { WidgetType } from "../widgets/types";

// テンプレート（er.md「DBに持たないもの」）。ボードを作るときに、ここから
// ウィジェット、設定、6つの表示先の配置をまとめて作る。
// ベーシックは画面設計の配置どおり。ほかは同じ考え方で決めた

export const TEMPLATE_IDS = [
  "basic",
  "standby",
  "family",
  "workdesk",
  "blank",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

// おすすめのテンプレート。初回の設定で、最初から選んでおき、「おすすめ」と出す
export const RECOMMENDED_TEMPLATE_ID: TemplateId = "basic";

export type Placement = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TemplateWidget = {
  type: WidgetType;
  settings: Record<string, unknown>;
  // 載っていない表示先では「未配置」
  placements: Partial<Record<DisplayTarget, Placement>>;
};

export type Template = {
  id: TemplateId;
  name: string;
  description: string;
  widgets: TemplateWidget[];
};

// 配置を短く書くため（page は1から、x と y は0から数える）
function at(x: number, y: number, w: number, h: number, page = 1): Placement {
  return { page, x, y, w, h };
}

// PC とタブレット横は、どちらも 4×3 なので同じ配置にする
function wide(placement: Placement) {
  return { pc: placement, tablet_landscape: placement };
}

export const TEMPLATES: Record<TemplateId, Template> = {
  basic: {
    id: "basic",
    name: "ベーシック",
    description: "時計・天気・カレンダーを中心にした定番の構成",
    widgets: [
      {
        type: "clock",
        settings: { worldClocks: ["new_york", "london", "sydney"] },
        placements: {
          ...wide(at(0, 0, 2, 2)),
          tablet_portrait: at(0, 0, 2, 2),
          sub_display: at(0, 0, 2, 2),
          phone_portrait: at(0, 0, 2, 1),
          phone_landscape: at(0, 0, 2, 2),
        },
      },
      {
        type: "weather",
        settings: {},
        placements: {
          ...wide(at(2, 0, 1, 2)),
          tablet_portrait: at(0, 2, 1, 2),
          sub_display: at(2, 0, 1, 2),
          phone_portrait: at(0, 1, 1, 3),
          phone_landscape: at(2, 0, 1, 1),
        },
      },
      {
        type: "calendar",
        settings: {},
        placements: {
          ...wide(at(3, 0, 1, 3)),
          tablet_portrait: at(2, 0, 1, 3),
          sub_display: at(5, 0, 1, 2),
          phone_portrait: at(0, 0, 2, 3, 2),
          phone_landscape: at(3, 0, 1, 2),
        },
      },
      {
        type: "memo",
        settings: {},
        placements: {
          ...wide(at(0, 2, 1, 1)),
          tablet_portrait: at(1, 2, 1, 1),
          sub_display: at(4, 0, 1, 1),
          phone_portrait: at(0, 3, 2, 1, 2),
        },
      },
      {
        type: "todo",
        settings: {},
        placements: {
          ...wide(at(1, 2, 1, 1)),
          tablet_portrait: at(1, 3, 1, 1),
          sub_display: at(3, 0, 1, 2),
          phone_portrait: at(1, 2, 1, 2),
        },
      },
      {
        type: "countdown",
        settings: {},
        placements: {
          ...wide(at(2, 2, 1, 1)),
          tablet_portrait: at(2, 3, 1, 1),
          sub_display: at(4, 1, 1, 1),
          phone_portrait: at(1, 1, 1, 1),
          phone_landscape: at(2, 1, 1, 1),
        },
      },
    ],
  },
  standby: {
    id: "standby",
    name: "スタンバイ",
    description: "大きな時計で離れた場所からも見やすく",
    widgets: [
      {
        type: "clock",
        settings: {},
        placements: {
          ...wide(at(0, 0, 3, 3)),
          tablet_portrait: at(0, 0, 3, 2),
          sub_display: at(0, 0, 4, 2),
          phone_portrait: at(0, 0, 2, 2),
          phone_landscape: at(0, 0, 3, 2),
        },
      },
      {
        type: "weather",
        settings: {},
        placements: {
          ...wide(at(3, 0, 1, 1)),
          tablet_portrait: at(0, 2, 1, 2),
          sub_display: at(4, 0, 1, 2),
          phone_portrait: at(0, 2, 1, 2),
          phone_landscape: at(3, 0, 1, 1),
        },
      },
      {
        type: "calendar",
        settings: {},
        placements: {
          ...wide(at(3, 1, 1, 2)),
          tablet_portrait: at(1, 2, 2, 2),
          sub_display: at(5, 0, 1, 2),
          phone_portrait: at(1, 2, 1, 2),
          phone_landscape: at(3, 1, 1, 1),
        },
      },
    ],
  },
  family: {
    id: "family",
    name: "ファミリー",
    description: "家族の予定・ToDo・メモをリビングで共有",
    widgets: [
      {
        type: "calendar",
        settings: {},
        placements: {
          ...wide(at(0, 0, 2, 2)),
          tablet_portrait: at(0, 0, 2, 2),
          sub_display: at(0, 0, 2, 2),
          phone_portrait: at(0, 1, 2, 2),
          phone_landscape: at(0, 0, 2, 2),
        },
      },
      {
        type: "clock",
        settings: {},
        placements: {
          ...wide(at(2, 0, 1, 1)),
          tablet_portrait: at(2, 0, 1, 1),
          sub_display: at(4, 0, 1, 1),
          phone_portrait: at(0, 0, 2, 1),
          phone_landscape: at(2, 0, 1, 1),
        },
      },
      {
        type: "weather",
        settings: {},
        placements: {
          ...wide(at(3, 0, 1, 1)),
          tablet_portrait: at(2, 1, 1, 1),
          sub_display: at(5, 0, 1, 1),
          phone_portrait: at(0, 3, 1, 1),
          phone_landscape: at(3, 0, 1, 1),
        },
      },
      {
        type: "todo",
        settings: {},
        placements: {
          ...wide(at(2, 1, 2, 2)),
          tablet_portrait: at(0, 2, 1, 2),
          sub_display: at(2, 0, 1, 2),
          phone_portrait: at(0, 0, 2, 2, 2),
          phone_landscape: at(2, 1, 1, 1),
        },
      },
      {
        type: "memo",
        settings: {},
        placements: {
          ...wide(at(0, 2, 1, 1)),
          tablet_portrait: at(1, 2, 2, 1),
          sub_display: at(3, 0, 1, 2),
          phone_portrait: at(0, 2, 2, 2, 2),
          phone_landscape: at(3, 1, 1, 1),
        },
      },
      {
        type: "countdown",
        settings: {},
        placements: {
          ...wide(at(1, 2, 1, 1)),
          tablet_portrait: at(1, 3, 2, 1),
          sub_display: at(4, 1, 2, 1),
          phone_portrait: at(1, 3, 1, 1),
        },
      },
    ],
  },
  workdesk: {
    id: "workdesk",
    name: "ワークデスク",
    description: "予定・ToDo・ニュースをサブモニターに",
    widgets: [
      {
        type: "clock",
        settings: { worldClocks: ["london", "new_york"] },
        placements: {
          ...wide(at(0, 0, 1, 1)),
          tablet_portrait: at(0, 0, 1, 1),
          sub_display: at(0, 0, 1, 1),
          phone_portrait: at(0, 0, 2, 1),
          phone_landscape: at(0, 0, 1, 1),
        },
      },
      {
        type: "weather",
        settings: {},
        placements: {
          ...wide(at(0, 1, 1, 2)),
          tablet_portrait: at(0, 1, 1, 1),
          sub_display: at(0, 1, 1, 1),
          phone_portrait: at(1, 0, 1, 2, 2),
          phone_landscape: at(0, 1, 1, 1),
        },
      },
      {
        type: "calendar",
        settings: {},
        placements: {
          ...wide(at(1, 0, 1, 3)),
          tablet_portrait: at(1, 0, 1, 4),
          sub_display: at(1, 0, 2, 2),
          phone_portrait: at(0, 1, 2, 3),
          phone_landscape: at(1, 0, 1, 2),
        },
      },
      {
        type: "todo",
        settings: {},
        placements: {
          ...wide(at(2, 0, 1, 3)),
          tablet_portrait: at(2, 0, 1, 4),
          sub_display: at(3, 0, 1, 2),
          phone_portrait: at(0, 0, 1, 2, 2),
          phone_landscape: at(2, 0, 1, 2),
        },
      },
      {
        type: "news",
        settings: {},
        placements: {
          ...wide(at(3, 0, 1, 3)),
          tablet_portrait: at(0, 2, 1, 2),
          sub_display: at(4, 0, 2, 2),
          phone_portrait: at(0, 2, 2, 2, 2),
          phone_landscape: at(3, 0, 1, 2),
        },
      },
    ],
  },
  blank: {
    id: "blank",
    name: "白紙から作成",
    description: "空のボードに好きなウィジェットを配置",
    widgets: [],
  },
};
