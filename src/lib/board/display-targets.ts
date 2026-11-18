// 表示先（er.md の display_target）と、表示先ごとのグリッドの大きさ。
// グリッドの大きさは DB に持たず、ここで決める（er.md「DBに持たないもの」）

export const DISPLAY_TARGETS = [
  "pc",
  "tablet_landscape",
  "tablet_portrait",
  "sub_display",
  "phone_portrait",
  "phone_landscape",
] as const;

export type DisplayTarget = (typeof DISPLAY_TARGETS)[number];

export type Grid = {
  cols: number;
  rows: number;
  // スマホ縦だけ、横にめくって2ページ目を見られる
  pages: number;
};

export const GRIDS: Record<DisplayTarget, Grid> = {
  pc: { cols: 4, rows: 3, pages: 1 },
  tablet_landscape: { cols: 4, rows: 3, pages: 1 },
  tablet_portrait: { cols: 3, rows: 4, pages: 1 },
  sub_display: { cols: 6, rows: 2, pages: 1 },
  phone_portrait: { cols: 2, rows: 4, pages: 2 },
  phone_landscape: { cols: 4, rows: 2, pages: 1 },
};

export const DISPLAY_TARGET_LABELS: Record<DisplayTarget, string> = {
  pc: "PC・モニター",
  tablet_landscape: "タブレット横",
  tablet_portrait: "タブレット縦",
  sub_display: "サブディスプレイ",
  phone_portrait: "スマホ縦",
  phone_landscape: "スマホ横",
};

// 画面設計の、表示先ごとの画面の大きさ（プレビューの縦横比に使う）
export const DESIGN_SIZES: Record<
  DisplayTarget,
  { width: number; height: number }
> = {
  pc: { width: 1920, height: 1080 },
  tablet_landscape: { width: 1194, height: 834 },
  tablet_portrait: { width: 834, height: 1194 },
  sub_display: { width: 1920, height: 480 },
  phone_portrait: { width: 393, height: 852 },
  phone_landscape: { width: 852, height: 393 },
};

// 画面の大きさから、合う表示先を選ぶ（表示先を固定していないとき）
export function pickDisplayTarget(
  width: number,
  height: number,
): DisplayTarget {
  const ratio = width / height;
  // とても横長なら、サブディスプレイ（1920×480 なら 4.0）
  if (ratio >= 2.5) {
    return "sub_display";
  }
  if (height > width) {
    return width < 600 ? "phone_portrait" : "tablet_portrait";
  }
  if (height < 500) {
    return "phone_landscape";
  }
  // 16:9 や 16:10 は PC、4:3 に近いものはタブレット
  return ratio >= 1.55 ? "pc" : "tablet_landscape";
}
