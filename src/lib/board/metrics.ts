import type { Grid } from "./display-targets";

export type BoardMetrics = {
  // 文字や余白の倍率（0.75〜1.3）
  scale: number;
  // ボードの外側の余白と、マスのあいだ（px）
  padding: number;
  gap: number;
};

const MIN_SCALE = 0.75;
const MAX_SCALE = 1.3;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// 余白とすきまも倍率で変わるので、倍率から決める。
// PC（1920×1080）で、余白40px・すきま24px（画面設計）になるようにしている
function spacing(scale: number) {
  return {
    // 小さい画面では余白を詰める（スマホで16px）
    padding: scale >= 1 ? 31 * scale : 16 + 60 * (scale - MIN_SCALE),
    gap: 19 * scale,
  };
}

// ボードの大きさから、倍率・余白・すきまを決める。
// 倍率は、マスの短い辺を 250px で割った値（画面設計「スケールの決め方」）
export function boardMetrics(
  width: number,
  height: number,
  grid: Pick<Grid, "cols" | "rows">,
): BoardMetrics {
  let scale = 1;
  // 倍率で余白が変わり、余白でマスの大きさが変わるので、何回か計算して落ち着かせる
  for (let i = 0; i < 4; i++) {
    const { padding, gap } = spacing(scale);
    const cellWidth = (width - padding * 2 - gap * (grid.cols - 1)) / grid.cols;
    const cellHeight =
      (height - padding * 2 - gap * (grid.rows - 1)) / grid.rows;
    scale = clamp(Math.min(cellWidth, cellHeight) / 250, MIN_SCALE, MAX_SCALE);
  }
  return { scale, ...spacing(scale) };
}
