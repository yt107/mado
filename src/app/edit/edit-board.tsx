"use client";

import { Scaling, SlidersHorizontal, SquareMinus } from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type KeyboardEvent,
  type Ref,
} from "react";

import { PAGER_HEIGHT } from "@/components/board/board-view";
import { gridArea, WidgetBody } from "@/components/widgets/widget-card";
import {
  DESIGN_SIZES,
  GRIDS,
  type DisplayTarget,
} from "@/lib/board/display-targets";
import {
  cellAt,
  describePlacement,
  moveBy,
  othersOn,
  placementOn,
} from "@/lib/board/edit";
import { canPlace, sizesThatFit } from "@/lib/board/layout";
import { boardMetrics } from "@/lib/board/metrics";
import type { BoardWidget } from "@/lib/board/schema";
import type { Placement } from "@/lib/board/templates";
import { cx } from "@/lib/cx";
import { SETTINGS_SCHEMAS } from "@/lib/widgets/settings";
import { WIDGET_LABELS } from "@/lib/widgets/types";

// スマホ縦の2ページを並べるときの、ページのあいだ（本物の大きさでの px）
const PAGE_GAP = 40;

export type Cell = { page: number; x: number; y: number };

// 一覧からのドラッグで、どのマスの上かを調べるために、外（Editor）から呼ぶ
export type BoardHandle = {
  hitTest: (clientX: number, clientY: number) => Cell | null;
};

// 一覧からドラッグしているときの、置く場所の見本
export type DropPreview = {
  placement: Placement;
  valid: boolean;
  label: string;
};

type Props = {
  ref?: Ref<BoardHandle>;
  widgets: BoardWidget[];
  target: DisplayTarget;
  selectedId: string | null;
  dropPreview: DropPreview | null;
  onSelect: (widgetId: string | null) => void;
  onCommit: (widgetId: string, placement: Placement) => void;
  onRemove: (widgetId: string) => void;
  onOpenSettings: (widgetId: string) => void;
  onAnnounce: (message: string) => void;
};

type DragState = {
  widgetId: string;
  mode: "move" | "resize";
  preview: Placement;
  valid: boolean;
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function samePlacement(a: Placement, b: Placement) {
  return (
    a.page === b.page &&
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    a.h === b.h
  );
}

// 編集モードのボード。本物の画面と同じ大きさで作り、編集する場所に収まるように縮めて見せる。
// だから並びも、文字とマスの大きさの割合も、表示モードと同じになる
export function EditBoard({
  ref,
  widgets,
  target,
  selectedId,
  dropPreview,
  onSelect,
  onCommit,
  onRemove,
  onOpenSettings,
  onAnnounce,
}: Props) {
  const grid = GRIDS[target];
  const design = DESIGN_SIZES[target];
  // スマホ縦は、表示モードと同じく、下のページ送りの点のぶんを引いた高さにする
  const pageWidth = design.width;
  const pageHeight =
    grid.pages > 1 ? design.height - PAGER_HEIGHT : design.height;
  const realWidth = pageWidth * grid.pages + PAGE_GAP * (grid.pages - 1);
  const realHeight = pageHeight;
  const metrics = useMemo(
    () => boardMetrics(pageWidth, pageHeight, grid),
    [pageWidth, pageHeight, grid],
  );

  // 編集する場所の大きさを測り、縮める割合（zoom）を決める
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<{ width: number; height: number } | null>(
    null,
  );
  useEffect(() => {
    const element = areaRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setArea({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const zoom = area
    ? Math.min(area.width / realWidth, area.height / realHeight, 1)
    : 0;
  const offset = area
    ? {
        left: (area.width - realWidth * zoom) / 2,
        top: (area.height - realHeight * zoom) / 2,
      }
    : { left: 0, top: 0 };

  // マスの大きさ（本物の大きさでの px）
  const cellWidth =
    (pageWidth - metrics.padding * 2 - metrics.gap * (grid.cols - 1)) /
    grid.cols;
  const cellHeight =
    (pageHeight - metrics.padding * 2 - metrics.gap * (grid.rows - 1)) /
    grid.rows;

  // 配置が、編集する場所のどこに見えているか（縮めたあとの px）。ツールバーを置くのに使う
  function rectOf(placement: Placement) {
    const left =
      (placement.page - 1) * (pageWidth + PAGE_GAP) +
      metrics.padding +
      placement.x * (cellWidth + metrics.gap);
    const top = metrics.padding + placement.y * (cellHeight + metrics.gap);
    const width = placement.w * cellWidth + (placement.w - 1) * metrics.gap;
    const height = placement.h * cellHeight + (placement.h - 1) * metrics.gap;
    return {
      left: offset.left + left * zoom,
      top: offset.top + top * zoom,
      width: width * zoom,
      height: height * zoom,
    };
  }

  const gridRefs = useRef<(HTMLDivElement | null)[]>([]);

  function hitTest(clientX: number, clientY: number): Cell | null {
    for (let i = 0; i < grid.pages; i++) {
      const element = gridRefs.current[i];
      if (!element) continue;
      const cell = cellAt(
        { x: clientX, y: clientY },
        element.getBoundingClientRect(),
        grid,
        metrics,
        zoom,
      );
      if (cell) return { page: i + 1, ...cell };
    }
    return null;
  }

  useImperativeHandle(ref, () => ({ hitTest }));

  // ドラッグ（移動とサイズの変更）。押してから4px動かすまでは、ただのクリックとして扱う
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragInfo = useRef<{
    widgetId: string;
    mode: "move" | "resize";
    origin: Placement;
    grab: { dx: number; dy: number };
    start: { x: number; y: number };
    started: boolean;
    latest: DragState | null;
  } | null>(null);
  // 直前の操作がドラッグだったか。ドラッグのあとのクリックで、設定を開かないために使う
  const draggedRef = useRef(false);

  function beginDrag(
    event: PointerEvent<HTMLElement>,
    widget: BoardWidget,
    mode: "move" | "resize",
  ) {
    if (event.button !== 0) return;
    draggedRef.current = false;
    const origin = placementOn(widget, target);
    if (!origin) return;
    const cell = hitTest(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragInfo.current = {
      widgetId: widget.id,
      mode,
      origin,
      // 押した場所とウィジェットの左上の差。動かしても、つかんだ場所がずれないように
      grab:
        cell && mode === "move"
          ? { dx: cell.x - origin.x, dy: cell.y - origin.y }
          : { dx: 0, dy: 0 },
      start: { x: event.clientX, y: event.clientY },
      started: false,
      latest: null,
    };
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const info = dragInfo.current;
    if (!info) return;
    if (!info.started) {
      const moved = Math.hypot(
        event.clientX - info.start.x,
        event.clientY - info.start.y,
      );
      if (moved < 4) return;
      info.started = true;
    }
    const cell = hitTest(event.clientX, event.clientY);
    const { origin } = info;
    let next = origin;
    if (cell && info.mode === "move") {
      next = {
        page: cell.page,
        x: clamp(cell.x - info.grab.dx, 0, grid.cols - origin.w),
        y: clamp(cell.y - info.grab.dy, 0, grid.rows - origin.h),
        w: origin.w,
        h: origin.h,
      };
    } else if (cell && cell.page === origin.page) {
      next = {
        ...origin,
        w: clamp(cell.x - origin.x + 1, 1, grid.cols - origin.x),
        h: clamp(cell.y - origin.y + 1, 1, grid.rows - origin.y),
      };
    }
    const valid =
      cell !== null &&
      canPlace(next, othersOn(widgets, target, info.widgetId), grid);
    info.latest = {
      widgetId: info.widgetId,
      mode: info.mode,
      preview: next,
      valid,
    };
    setDrag(info.latest);
  }

  function endDrag() {
    const info = dragInfo.current;
    dragInfo.current = null;
    setDrag(null);
    draggedRef.current = info?.started ?? false;
    if (!info?.started || !info.latest) return;
    if (!info.latest.valid) {
      onAnnounce("そこには置けないので、元の場所に戻しました");
      return;
    }
    if (!samePlacement(info.latest.preview, info.origin)) {
      onCommit(info.widgetId, info.latest.preview);
    }
  }

  // ドラッグせずにクリックしたら、そのウィジェットの設定を開く。
  // ドラッグで動かしたあとのクリックは無視する（動かしただけで、設定が開かないように）
  function onWidgetClick(widget: BoardWidget) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onSelect(widget.id);
    if (SETTINGS_SCHEMAS[widget.type]) {
      onOpenSettings(widget.id);
    }
  }

  // キーボード。矢印キーで1マス動かし、Enter でツールバーへ、Esc で選ぶのをやめる
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [focusToolbar, setFocusToolbar] = useState(0);
  useEffect(() => {
    if (focusToolbar > 0) {
      toolbarRef.current?.querySelector<HTMLElement>("button, select")?.focus();
    }
  }, [focusToolbar]);

  function onWidgetKeyDown(event: KeyboardEvent, widget: BoardWidget) {
    const origin = placementOn(widget, target);
    if (!origin) return;
    const arrow = ARROWS[event.key];
    if (arrow) {
      event.preventDefault();
      onSelect(widget.id);
      const next = moveBy(
        origin,
        arrow[0],
        arrow[1],
        othersOn(widgets, target, widget.id),
        grid,
      );
      if (next) {
        onCommit(widget.id, next);
      } else {
        onAnnounce("その方向には動かせません");
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(widget.id);
      setFocusToolbar((n) => n + 1);
    } else if (event.key === "Escape") {
      onSelect(null);
    }
  }

  const items = widgets.flatMap((widget) => {
    const placement = placementOn(widget, target);
    return placement ? [{ widget, placement }] : [];
  });
  const selected = items.find((item) => item.widget.id === selectedId) ?? null;
  // ドラッグ中は、動かした先の場所を見本として出す
  const preview: DropPreview | null = drag
    ? {
        placement: drag.preview,
        valid: drag.valid,
        label: drag.valid ? "ここに置く" : "ここには置けません",
      }
    : dropPreview;
  const showCells = drag !== null || dropPreview !== null;

  return (
    <div
      ref={areaRef}
      className="relative min-h-0 flex-1"
      onPointerDown={(event) => {
        // ウィジェットやツールバーの外（ボードの空いているところなど）を押したら、選ぶのをやめる
        const element = event.target as Element;
        if (!element.closest("[data-widget], [data-toolbar]")) {
          onSelect(null);
        }
      }}
    >
      {area && (
        <div
          className="absolute"
          style={{
            left: offset.left,
            top: offset.top,
            width: realWidth * zoom,
            height: realHeight * zoom,
          }}
        >
          <div
            className="flex origin-top-left"
            style={
              {
                width: realWidth,
                height: realHeight,
                gap: PAGE_GAP,
                transform: `scale(${zoom})`,
                "--scale": metrics.scale,
              } as CSSProperties
            }
          >
            {Array.from({ length: grid.pages }, (_, i) => i + 1).map((page) => (
              <div
                key={page}
                role={grid.pages > 1 ? "group" : undefined}
                aria-label={grid.pages > 1 ? `${page}ページ目` : undefined}
                className="relative shrink-0 rounded-[28px] border-2 border-line bg-canvas"
                style={{ width: pageWidth, height: pageHeight }}
              >
                <div
                  ref={(element) => {
                    gridRefs.current[page - 1] = element;
                  }}
                  className="grid size-full"
                  style={{
                    gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
                    gap: metrics.gap,
                    padding: metrics.padding,
                  }}
                >
                  {/* ドラッグ中は、マスの区切りを薄く出す（置く場所を狙いやすく） */}
                  {showCells &&
                    Array.from({ length: grid.cols * grid.rows }, (_, i) => (
                      <div
                        key={`cell-${i}`}
                        aria-hidden
                        className="rounded-[calc(19px*var(--scale))] border-2 border-dashed border-line"
                        style={{
                          gridColumn: (i % grid.cols) + 1,
                          gridRow: Math.floor(i / grid.cols) + 1,
                        }}
                      />
                    ))}

                  {items
                    .filter((item) => item.placement.page === page)
                    .map(({ widget, placement }) => (
                      <div
                        key={widget.id}
                        data-widget
                        role="button"
                        tabIndex={0}
                        aria-pressed={widget.id === selectedId}
                        aria-label={`${WIDGET_LABELS[widget.type]}、${describePlacement(placement, grid)}。矢印キーで移動、Enter で操作`}
                        className={cx(
                          "relative min-h-0 min-w-0 cursor-grab touch-none rounded-[calc(19px*var(--scale))] select-none",
                          drag?.widgetId === widget.id && "opacity-40",
                        )}
                        style={gridArea(placement)}
                        onPointerDown={(event) => {
                          onSelect(widget.id);
                          beginDrag(event, widget, "move");
                        }}
                        onPointerMove={moveDrag}
                        onLostPointerCapture={endDrag}
                        onClick={() => onWidgetClick(widget)}
                        onKeyDown={(event) => onWidgetKeyDown(event, widget)}
                      >
                        <WidgetBody
                          widget={widget}
                          placement={placement}
                          className="pointer-events-none"
                        />
                      </div>
                    ))}

                  {preview && preview.placement.page === page && (
                    <div
                      aria-hidden
                      className={cx(
                        "z-10 flex flex-col items-center justify-center gap-[0.3em] rounded-[calc(19px*var(--scale))] border-[3px] border-dashed text-center font-bold",
                        preview.valid
                          ? "border-accent bg-accent/15 text-accent-ink"
                          : "border-danger bg-danger/15 text-danger",
                      )}
                      style={{
                        ...gridArea(preview.placement),
                        fontSize: `max(13px, calc(16px * var(--scale)))`,
                      }}
                    >
                      <span>{preview.label}</span>
                      <span className="text-[0.8em] font-normal">
                        {preview.placement.w} × {preview.placement.h}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 選んだウィジェットの枠、ツールバー、サイズを変えるつまみ（縮めずに、そのままの大きさで出す） */}
      {/* ドラッグ中もつまみは消さない（消すと、つかんでいたつまみがなくなり、ドラッグが止まるため） */}
      {selected && area && (
        <SelectionOverlay
          dragging={drag !== null}
          rect={rectOf(selected.placement)}
          widget={selected.widget}
          placement={selected.placement}
          sizes={sizesThatFit(
            selected.placement,
            othersOn(widgets, target, selected.widget.id),
            grid,
          )}
          toolbarRef={toolbarRef}
          onResizeStart={(event) => beginDrag(event, selected.widget, "resize")}
          onResizeMove={moveDrag}
          onResizeEnd={endDrag}
          onCommit={onCommit}
          onRemove={onRemove}
          onOpenSettings={onOpenSettings}
        />
      )}

      {area && (
        <p className="absolute right-0 bottom-0 rounded-md bg-raised px-2 py-1 text-xs text-ink-3">
          表示 {Math.round(zoom * 100)}%
        </p>
      )}
    </div>
  );
}

function SelectionOverlay({
  dragging,
  rect,
  widget,
  placement,
  sizes,
  toolbarRef,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onCommit,
  onRemove,
  onOpenSettings,
}: {
  dragging: boolean;
  rect: { left: number; top: number; width: number; height: number };
  widget: BoardWidget;
  placement: Placement;
  sizes: { w: number; h: number }[];
  toolbarRef: Ref<HTMLDivElement>;
  onResizeStart: (event: PointerEvent<HTMLElement>) => void;
  onResizeMove: (event: PointerEvent<HTMLElement>) => void;
  onResizeEnd: () => void;
  onCommit: (widgetId: string, placement: Placement) => void;
  onRemove: (widgetId: string) => void;
  onOpenSettings: (widgetId: string) => void;
}) {
  const label = WIDGET_LABELS[widget.type];
  const hasSettings = SETTINGS_SCHEMAS[widget.type] !== undefined;
  // ツールバーは上に出す。上に場所がなければ、ウィジェットの中の上に出す
  const toolbarTop = rect.top >= 52 ? rect.top - 8 : rect.top + 8;
  const toolbarShift = rect.top >= 52 ? "-100%" : "0%";

  return (
    <>
      <div
        aria-hidden
        className={cx(
          "pointer-events-none absolute rounded-xl outline-2 outline-offset-2 outline-accent",
          dragging && "hidden",
        )}
        style={rect}
      />

      <div
        ref={toolbarRef}
        hidden={dragging}
        data-toolbar
        role="group"
        aria-label={`${label}の操作`}
        onKeyDown={(event) => {
          // Esc で、ウィジェットに戻る
          if (event.key === "Escape") {
            (
              document.querySelector(
                '[data-widget][aria-pressed="true"]',
              ) as HTMLElement | null
            )?.focus();
          }
        }}
        className="absolute z-20 flex items-center gap-1 rounded-xl border border-line bg-card p-1 text-sm whitespace-nowrap text-ink shadow-xl"
        style={{
          left: rect.left + rect.width / 2,
          top: toolbarTop,
          transform: `translate(-50%, ${toolbarShift})`,
        }}
      >
        <button
          type="button"
          aria-disabled={!hasSettings}
          title={hasSettings ? "設定" : "このウィジェットの設定は準備中です"}
          onClick={() => hasSettings && onOpenSettings(widget.id)}
          className={cx(
            "flex min-h-8 items-center gap-1.5 rounded-lg px-2.5",
            hasSettings
              ? "text-accent-ink hover:bg-raised"
              : "cursor-not-allowed text-ink-3",
          )}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          設定
        </button>
        <label className="flex min-h-8 items-center gap-1.5 rounded-lg px-2 hover:bg-raised has-focus-visible:outline-2 has-focus-visible:outline-accent">
          <Scaling aria-hidden className="size-4 text-ink-2" />
          <select
            aria-label="大きさ"
            value={`${placement.w}x${placement.h}`}
            onChange={(event) => {
              const [w = 1, h = 1] = event.target.value.split("x").map(Number);
              onCommit(widget.id, { ...placement, w, h });
            }}
            className="cursor-pointer bg-transparent outline-none"
          >
            {sizes.map(({ w, h }) => (
              <option key={`${w}x${h}`} value={`${w}x${h}`}>
                {w} × {h}
              </option>
            ))}
          </select>
        </label>
        <span aria-hidden className="h-5 w-px bg-line" />
        <button
          type="button"
          onClick={() => onRemove(widget.id)}
          className="flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 hover:bg-raised"
        >
          <SquareMinus aria-hidden className="size-4" />
          外す
        </button>
      </div>

      {/* 右下のつまみ。ドラッグで大きさを変える（キーボードでは、ツールバーの大きさを使う） */}
      <div
        data-toolbar
        aria-hidden
        className="absolute z-20 grid size-6 cursor-nwse-resize touch-none place-items-center"
        style={{
          left: rect.left + rect.width - 12,
          top: rect.top + rect.height - 12,
        }}
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onLostPointerCapture={onResizeEnd}
      >
        <span className="size-3.5 rounded-full bg-accent ring-2 ring-canvas" />
      </div>
    </>
  );
}
