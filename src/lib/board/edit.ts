import { DEFAULT_SIZES, type WidgetType } from "../widgets/types";
import { GRIDS, type DisplayTarget, type Grid } from "./display-targets";
import { canPlace, clampSize } from "./layout";
import type { BoardMetrics } from "./metrics";
import type { BoardWidget } from "./schema";
import type { Placement } from "./templates";

// 編集モードの計算（画面の操作に使う。DOM には触らない）

// ウィジェットの、ある表示先の配置。置いていなければ null
export function placementOn(
  widget: BoardWidget,
  target: DisplayTarget,
): Placement | null {
  const found = widget.placements.find((p) => p.displayTarget === target);
  if (!found) return null;
  const { page, x, y, w, h } = found;
  return { page, x, y, w, h };
}

// ある表示先に置かれている、ほかのウィジェットの配置（重なりの確認に使う）
export function othersOn(
  widgets: BoardWidget[],
  target: DisplayTarget,
  exceptId?: string,
): Placement[] {
  return widgets.flatMap((widget) => {
    if (widget.id === exceptId) return [];
    const placement = placementOn(widget, target);
    return placement ? [placement] : [];
  });
}

// 画面上の位置（マウスや指の位置）が、どのマスの上かを返す。グリッドの外なら null。
// rect はグリッドの、画面上の位置と大きさ（縮めて見せているときは、縮めたあとの値）
export function cellAt(
  point: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  grid: Pick<Grid, "cols" | "rows">,
  metrics: Pick<BoardMetrics, "padding" | "gap">,
  zoom: number,
): { x: number; y: number } | null {
  const padding = metrics.padding * zoom;
  const gap = metrics.gap * zoom;
  const innerWidth = rect.width - padding * 2;
  const innerHeight = rect.height - padding * 2;
  const px = point.x - rect.left - padding;
  const py = point.y - rect.top - padding;
  // 外側の余白の少し外までは、端のマスとして扱う
  if (
    px < -padding ||
    py < -padding ||
    px > innerWidth + padding ||
    py > innerHeight + padding
  ) {
    return null;
  }
  const cellWidth = (innerWidth - gap * (grid.cols - 1)) / grid.cols;
  const cellHeight = (innerHeight - gap * (grid.rows - 1)) / grid.rows;
  const clamp = (value: number, max: number) =>
    Math.min(Math.max(value, 0), max);
  return {
    x: clamp(Math.floor((px + gap / 2) / (cellWidth + gap)), grid.cols - 1),
    y: clamp(Math.floor((py + gap / 2) / (cellHeight + gap)), grid.rows - 1),
  };
}

// 一覧から置くときの場所。押したマスに、決まった大きさで置く（はみ出すなら左上へずらす）。
// 入らなければ、そのマスに 1×1 で置けるかを試す
export function dropPlacement(
  type: WidgetType,
  cell: { page: number; x: number; y: number },
  others: Placement[],
  target: DisplayTarget,
): { placement: Placement; valid: boolean } {
  const grid = GRIDS[target];
  const size = clampSize(DEFAULT_SIZES[type], grid);
  const placement = {
    page: cell.page,
    x: Math.min(cell.x, grid.cols - size.w),
    y: Math.min(cell.y, grid.rows - size.h),
    ...size,
  };
  if (canPlace(placement, others, grid)) {
    return { placement, valid: true };
  }
  const small = { page: cell.page, x: cell.x, y: cell.y, w: 1, h: 1 };
  if (canPlace(small, others, grid)) {
    return { placement: small, valid: true };
  }
  return { placement, valid: false };
}

// 矢印キーで1マス動かす。動かせなければ null
export function moveBy(
  placement: Placement,
  dx: number,
  dy: number,
  others: Placement[],
  grid: Grid,
): Placement | null {
  const moved = { ...placement, x: placement.x + dx, y: placement.y + dy };
  return canPlace(moved, others, grid) ? moved : null;
}

// 位置を「2列目・1行目」のように言葉にする（読み上げに使う）
export function describePlacement(placement: Placement, grid: Grid): string {
  const page = grid.pages > 1 ? `${placement.page}ページ目の` : "";
  return `${page}${placement.x + 1}列目・${placement.y + 1}行目、${placement.w}×${placement.h}`;
}
