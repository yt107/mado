"use client";

import { PanelLeftClose, Plus } from "lucide-react";
import { useRef } from "react";

import { WIDGET_ICONS } from "@/components/widgets/widget-icon";
import { cx } from "@/lib/cx";
import {
  WIDGET_DESCRIPTIONS,
  WIDGET_LABELS,
  WIDGET_TYPES,
  type WidgetType,
} from "@/lib/widgets/types";

// 一覧のアイコンの色（画面設計のウィジェット一覧）
const ICON_COLORS: Record<WidgetType, string> = {
  clock: "#2f3540",
  weather: "#3d72b4",
  calendar: "#e5534b",
  todo: "#3fae74",
  memo: "#c9a33d",
  countdown: "#e0872f",
  news: "#7c6cf0",
};

// この表示先での状態。placed：置いてある、unplaced：中身はあるが、この表示先には置いていない
export type PaletteStatus = "placed" | "unplaced" | "new";

type Props = {
  statusOf: (type: WidgetType) => PaletteStatus;
  draggingType: WidgetType | null;
  onAdd: (type: WidgetType) => void;
  onDragStart: (type: WidgetType, x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  onCollapse: () => void;
};

// 左の一覧。ボードへドラッグして置く。ドラッグできない人のために「追加」ボタンも置く
export function WidgetPalette({
  statusOf,
  draggingType,
  onAdd,
  onDragStart,
  onDragMove,
  onDragEnd,
  onCollapse,
}: Props) {
  // 押してから少し動かすまでは、ドラッグを始めない（ただのクリックと区別する）
  const press = useRef<{ type: WidgetType; x: number; y: number } | null>(null);
  const dragging = useRef(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 px-5 pt-6">
        <div>
          <h2 className="font-bold">ウィジェットを追加</h2>
          <p className="mt-1 text-xs text-ink-3">
            ボードの空きマスへドラッグして配置
          </p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="一覧をたたむ"
          title="一覧をたたむ"
          className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
        >
          <PanelLeftClose aria-hidden className="size-4" />
        </button>
      </div>

      <ul className="mt-5 flex flex-col gap-1 overflow-y-auto px-3">
        {WIDGET_TYPES.map((type) => {
          const Icon = WIDGET_ICONS[type];
          const status = statusOf(type);
          const placed = status === "placed";
          const isDragging = draggingType === type;
          return (
            <li
              key={type}
              className={cx(
                "flex items-center gap-2 rounded-xl border p-2",
                isDragging
                  ? "border-accent bg-accent/10"
                  : "border-transparent hover:bg-raised",
              )}
            >
              {/* ここを押して、ボードへドラッグする（マウスでも指でも） */}
              <div
                className={cx(
                  "flex min-w-0 flex-1 touch-none items-center gap-3 select-none",
                  placed ? "cursor-default opacity-60" : "cursor-grab",
                )}
                onPointerDown={(event) => {
                  if (placed || event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  press.current = {
                    type,
                    x: event.clientX,
                    y: event.clientY,
                  };
                }}
                onPointerMove={(event) => {
                  const start = press.current;
                  if (!start) return;
                  if (!dragging.current) {
                    const moved = Math.hypot(
                      event.clientX - start.x,
                      event.clientY - start.y,
                    );
                    if (moved < 4) return;
                    dragging.current = true;
                    onDragStart(start.type, event.clientX, event.clientY);
                    return;
                  }
                  onDragMove(event.clientX, event.clientY);
                }}
                onLostPointerCapture={() => {
                  if (dragging.current) onDragEnd();
                  dragging.current = false;
                  press.current = null;
                }}
              >
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white"
                  style={{ backgroundColor: ICON_COLORS[type] }}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">
                    {WIDGET_LABELS[type]}
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {WIDGET_DESCRIPTIONS[type]}
                  </span>
                </span>
              </div>

              {isDragging ? (
                <Badge tone="accent">ドラッグ中</Badge>
              ) : placed ? (
                <Badge tone="muted">配置済み</Badge>
              ) : (
                <>
                  {status === "unplaced" && (
                    <Badge tone="outline">未配置</Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => onAdd(type)}
                    aria-label={`${WIDGET_LABELS[type]}を空いている場所に追加`}
                    title="空いている場所に追加"
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-card hover:text-ink"
                  >
                    <Plus aria-hidden className="size-4" />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="mt-auto flex flex-col gap-2 border-t border-line px-5 py-4 text-[0.6875rem] text-ink-3">
        <div className="flex items-center gap-2">
          <dt>
            <Badge tone="muted">配置済み</Badge>
          </dt>
          <dd>この表示先に置いてある</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt>
            <Badge tone="outline">未配置</Badge>
          </dt>
          <dd>中身は残っている。ドラッグで置ける</dd>
        </div>
      </dl>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "muted" | "outline" | "accent";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] whitespace-nowrap",
        tone === "muted" && "bg-raised text-ink-3",
        tone === "outline" && "border border-accent/60 text-accent-ink",
        tone === "accent" && "bg-accent font-bold text-on-accent",
      )}
    >
      {children}
    </span>
  );
}
