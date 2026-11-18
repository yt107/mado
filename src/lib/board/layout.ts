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
