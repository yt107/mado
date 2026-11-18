import { widgetSize } from "@/lib/board/sample";
import type { BoardWidget } from "@/lib/board/schema";
import type { Placement } from "@/lib/board/templates";
import { cx } from "@/lib/cx";
import { WIDGET_LABELS, type WidgetType } from "@/lib/widgets/types";

import { ClockWidget } from "./clock-widget";
import { PlaceholderWidget } from "./placeholder-widget";

// 種類ごとの色（画面設計：天気は青のグラデーション、メモは黄色、ほかはカード色）
const TONES: Partial<Record<WidgetType, string>> = {
  weather: "bg-linear-to-b from-weather-from to-weather-to text-white",
  memo: "bg-memo text-memo-ink",
};

type Props = {
  widget: BoardWidget;
  placement: Placement;
};

// ボードの1マス分の枠。置く場所をグリッドで指定し、中身は種類ごとに描く
export function WidgetCard({ widget, placement }: Props) {
  const size = widgetSize(placement.w, placement.h);
  return (
    <section
      aria-label={WIDGET_LABELS[widget.type]}
      data-size={size}
      className={cx("widget", TONES[widget.type] ?? "bg-card text-ink")}
      style={{
        gridColumn: `${placement.x + 1} / span ${placement.w}`,
        gridRow: `${placement.y + 1} / span ${placement.h}`,
      }}
    >
      {widget.type === "clock" ? (
        <ClockWidget settings={widget.settings} size={size} />
      ) : (
        <PlaceholderWidget type={widget.type} />
      )}
    </section>
  );
}
