import { DESIGN_SIZES, type DisplayTarget } from "@/lib/board/display-targets";
import type { BoardWidget } from "@/lib/board/schema";
import { cx } from "@/lib/cx";

import { BoardView } from "./board-view";

type Props = {
  widgets: BoardWidget[];
  target: DisplayTarget;
  // プレビューの高さの上限（縦長のスマホでも、はみ出さないように）
  maxHeight?: string;
  className?: string;
};

// ボードの見本。表示先の画面と同じ縦横比の枠に、本物と同じ部品で描く
export function BoardPreview({
  widgets,
  target,
  maxHeight = "60vh",
  className,
}: Props) {
  const { width, height } = DESIGN_SIZES[target];
  return (
    <div
      className={cx(
        "mx-auto w-full overflow-hidden rounded-[20px] border border-line bg-canvas",
        className,
      )}
      style={{
        aspectRatio: `${width} / ${height}`,
        maxWidth: `calc(${maxHeight} * ${width} / ${height})`,
      }}
    >
      <BoardView widgets={widgets} target={target} />
    </div>
  );
}
