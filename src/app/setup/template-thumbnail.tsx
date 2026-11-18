import { GRIDS } from "@/lib/board/display-targets";
import type { Template } from "@/lib/board/templates";
import type { WidgetType } from "@/lib/widgets/types";

// 小さな絵の色（天気は青、メモは黄色、ほかは灰色）
const COLORS: Partial<Record<WidgetType, string>> = {
  weather: "bg-linear-to-b from-weather-from to-weather-to",
  memo: "bg-memo",
};

// テンプレートの小さな絵。PC での配置を、4×3 のマスで描く
export function TemplateThumbnail({ template }: { template: Template }) {
  const { cols, rows } = GRIDS.pc;
  return (
    <div
      aria-hidden
      className="grid aspect-[16/10] w-28 shrink-0 gap-0.5 rounded-lg border border-line bg-canvas p-1"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {template.widgets.length === 0
        ? // 白紙は、空のマスだけ
          Array.from({ length: cols * rows }, (_, i) => (
            <span key={i} className="rounded-[3px] border border-line" />
          ))
        : template.widgets.map((widget) => {
            const p = widget.placements.pc;
            if (!p) return null;
            return (
              <span
                key={widget.type}
                className={`rounded-[3px] ${COLORS[widget.type] ?? "bg-raised"}`}
                style={{
                  gridColumn: `${p.x + 1} / span ${p.w}`,
                  gridRow: `${p.y + 1} / span ${p.h}`,
                }}
              />
            );
          })}
    </div>
  );
}
