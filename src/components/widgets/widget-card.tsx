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

// ボードの1マス分の枠。置く場所をグリッドで指定し、中身は種類ごとに描く（表示モード）
export function WidgetCard({ widget, placement }: Props) {
  return (
    <section
      aria-label={WIDGET_LABELS[widget.type]}
      className="min-h-0 min-w-0"
      style={gridArea(placement)}
    >
      <WidgetBody widget={widget} placement={placement} />
    </section>
  );
}

// ウィジェットの見た目（色と中身）。置く場所は決めない（編集モードと共通）
export function WidgetBody({
  widget,
  placement,
  className,
}: Props & { className?: string }) {
  const size = widgetSize(placement.w, placement.h);
  return (
    <div
      data-size={size}
      className={cx(
        "widget size-full",
        TONES[widget.type] ?? "bg-card text-ink",
        className,
      )}
    >
      {widget.type === "clock" ? (
        <ClockWidget settings={widget.settings} size={size} />
      ) : (
        <PlaceholderWidget type={widget.type} />
      )}
    </div>
  );
}

// グリッドの中の位置（x と y は0から数える）
export function gridArea(placement: Placement) {
  return {
    gridColumn: `${placement.x + 1} / span ${placement.w}`,
    gridRow: `${placement.y + 1} / span ${placement.h}`,
  };
}
