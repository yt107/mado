"use client";

import { useEffect, useRef, useState } from "react";

import { DESIGN_SIZES, type DisplayTarget } from "@/lib/board/display-targets";
import type { BoardWidget } from "@/lib/board/schema";
import { cx } from "@/lib/cx";

import { SampleMode } from "../widgets/sample-mode";
import { BoardView } from "./board-view";

type Props = {
  widgets: BoardWidget[];
  target: DisplayTarget;
  // プレビューの高さの上限（縦長のスマホでも、はみ出さないように）
  maxHeight?: string;
  className?: string;
};

// ボードの見本。本物と同じ部品を、表示先の画面の大きさ（DESIGN_SIZES）で描いてから、
// 枠に合わせて縮める（編集モードと同じやり方）。
// 枠の大きさのまま描くと、文字の倍率の下限（0.75倍）より小さくできず、
// スマホなどの小さいマスで文字が重なってしまう
export function BoardPreview({
  widgets,
  target,
  maxHeight = "60vh",
  className,
}: Props) {
  const design = DESIGN_SIZES[target];

  // 枠の大きさを測り、縮める割合（zoom）を決める
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setZoom(Math.min(width / design.width, height / design.height));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [design.width, design.height]);

  return (
    <div
      ref={frameRef}
      className={cx(
        "mx-auto w-full overflow-hidden rounded-[20px] border border-line bg-canvas",
        className,
      )}
      style={{
        aspectRatio: `${design.width} / ${design.height}`,
        maxWidth: `calc(${maxHeight} * ${design.width} / ${design.height})`,
      }}
    >
      <div
        className="origin-top-left"
        style={{
          width: design.width,
          height: design.height,
          transform: `scale(${zoom ?? 0})`,
          // 測り終わるまでは隠す（縮める前の大きさで一瞬見えないように）
          visibility: zoom ? undefined : "hidden",
        }}
      >
        {/* 見本なので、天気・予定・ニュースは見本の中身を出す */}
        <SampleMode>
          <BoardView widgets={widgets} target={target} />
        </SampleMode>
      </div>
    </div>
  );
}
