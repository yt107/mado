import { widgetSize, type WidgetSize } from "@/lib/board/sample";
import type { BoardWidget } from "@/lib/board/schema";
import type { Placement } from "@/lib/board/templates";
import { cx } from "@/lib/cx";
import { readMemoSettings, type MemoSettings } from "@/lib/widgets/memo";
import { WIDGET_LABELS } from "@/lib/widgets/types";

import { ClockWidget } from "./clock-widget";
import { CountdownWidget } from "./countdown-widget";
import { MemoWidget } from "./memo-widget";
import { PlaceholderWidget } from "./placeholder-widget";
import { TodoWidget } from "./todo-widget";

// メモの背景の色（画面設計「メモの設定」の5色）。濃い色だけ、文字を明るくする
const MEMO_TONES: Record<MemoSettings["color"], string> = {
  yellow: "bg-memo text-memo-ink",
  pink: "bg-[#f2c4ce] text-[#3d2228]",
  blue: "bg-[#c7ddf2] text-[#1e2d3d]",
  green: "bg-[#cde8c7] text-[#203320]",
  dark: "bg-[#2a2f38] text-[#f3f2ee]",
};

// 種類ごとの色（画面設計：天気は青のグラデーション、メモは設定の色、ほかはカード色）
function toneOf(widget: BoardWidget) {
  if (widget.type === "weather") {
    return "bg-linear-to-b from-weather-from to-weather-to text-white";
  }
  if (widget.type === "memo") {
    return MEMO_TONES[readMemoSettings(widget.settings).color];
  }
  return "bg-card text-ink";
}

type Props = {
  widget: BoardWidget;
  placement: Placement;
  // 表示モードでは、ToDo のチェックだけができる
  interactive?: boolean;
};

// ボードの1マス分の枠。置く場所をグリッドで指定し、中身は種類ごとに描く（表示モード）
export function WidgetCard({ widget, placement, interactive }: Props) {
  return (
    <section
      aria-label={WIDGET_LABELS[widget.type]}
      className="min-h-0 min-w-0"
      style={gridArea(placement)}
    >
      <WidgetBody
        widget={widget}
        placement={placement}
        interactive={interactive}
      />
    </section>
  );
}

// ウィジェットの見た目（色と中身）。置く場所は決めない（編集モードと共通）
export function WidgetBody({
  widget,
  placement,
  interactive = false,
  className,
}: Props & { className?: string }) {
  const size = widgetSize(placement.w, placement.h);
  return (
    <div
      data-size={size}
      className={cx("widget size-full", toneOf(widget), className)}
    >
      <WidgetContent widget={widget} size={size} interactive={interactive} />
    </div>
  );
}

function WidgetContent({
  widget,
  size,
  interactive,
}: {
  widget: BoardWidget;
  size: WidgetSize;
  interactive: boolean;
}) {
  switch (widget.type) {
    case "clock":
      return <ClockWidget settings={widget.settings} size={size} />;
    case "todo":
      return <TodoWidget widget={widget} interactive={interactive} />;
    case "memo":
      return <MemoWidget widget={widget} />;
    case "countdown":
      return <CountdownWidget widget={widget} />;
    default:
      return <PlaceholderWidget type={widget.type} />;
  }
}

// グリッドの中の位置（x と y は0から数える）
export function gridArea(placement: Placement) {
  return {
    gridColumn: `${placement.x + 1} / span ${placement.w}`,
    gridRow: `${placement.y + 1} / span ${placement.h}`,
  };
}
