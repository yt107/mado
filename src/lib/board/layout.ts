import type { Grid } from "./display-targets";
import type { Placement } from "./templates";

// 配置がグリッドの中に収まっているか（ページも含めて）
export function fitsGrid(placement: Placement, grid: Grid): boolean {
  const { page, x, y, w, h } = placement;
  return (
    page >= 1 &&
    page <= grid.pages &&
    x >= 0 &&
    y >= 0 &&
    w >= 1 &&
    h >= 1 &&
    x + w <= grid.cols &&
    y + h <= grid.rows
  );
}

// 2つの配置が重なっているか（違うページなら重ならない）
export function overlaps(a: Placement, b: Placement): boolean {
  return (
    a.page === b.page &&
    a.x < b.x + b.w &&
    b.x < a.x + a.w &&
    a.y < b.y + b.h &&
    b.y < a.y + a.h
  );
}

// グリッドに収まり、ほかの配置と重ならなければ置ける
export function canPlace(
  placement: Placement,
  others: Placement[],
  grid: Grid,
): boolean {
  return (
    fitsGrid(placement, grid) && others.every((o) => !overlaps(placement, o))
  );
}

// その大きさで置ける、いちばん上・左の場所を探す。なければ null
export function findFreeSpot(
  size: { w: number; h: number },
  others: Placement[],
  grid: Grid,
): Placement | null {
  for (let page = 1; page <= grid.pages; page++) {
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const placement = { page, x, y, ...size };
        if (canPlace(placement, others, grid)) {
          return placement;
        }
      }
    }
  }
  return null;
}

// 今の位置から選べる大きさ（収まって、重ならないもの）
export function sizesThatFit(
  at: Pick<Placement, "page" | "x" | "y">,
  others: Placement[],
  grid: Grid,
): { w: number; h: number }[] {
  const sizes: { w: number; h: number }[] = [];
  for (let h = 1; h <= grid.rows - at.y; h++) {
    for (let w = 1; w <= grid.cols - at.x; w++) {
      if (canPlace({ ...at, w, h }, others, grid)) {
        sizes.push({ w, h });
      }
    }
  }
  return sizes;
}

// 大きさを、グリッドに入る大きさまで小さくする（行が2つしかない表示先など）
export function clampSize(
  size: { w: number; h: number },
  grid: Grid,
): { w: number; h: number } {
  return { w: Math.min(size.w, grid.cols), h: Math.min(size.h, grid.rows) };
}
