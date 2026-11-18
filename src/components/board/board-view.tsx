"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { GRIDS, type DisplayTarget } from "@/lib/board/display-targets";
import { boardMetrics, type BoardMetrics } from "@/lib/board/metrics";
import type { BoardWidget } from "@/lib/board/schema";
import type { Placement } from "@/lib/board/templates";
import { cx } from "@/lib/cx";

import { WidgetCard } from "../widgets/widget-card";

// ページ送りの点の高さ（スマホ縦で2ページあるとき）
export const PAGER_HEIGHT = 28;

type Item = { widget: BoardWidget; placement: Placement };

type Props = {
  widgets: BoardWidget[];
  target: DisplayTarget;
  className?: string;
};

// ボードを、表示先のグリッドに並べて描く。表示モードとプレビューの両方で使う。
// 置かれた場所の大きさを測り、文字や余白の倍率（--scale）を決める
export function BoardView({ widgets, target, className }: Props) {
  const grid = GRIDS[target];
  const ref = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<BoardMetrics | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const pageHeight = grid.pages > 1 ? height - PAGER_HEIGHT : height;
      setMetrics(boardMetrics(width, pageHeight, grid));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [grid]);

  // この表示先に置かれたウィジェットを、ページごとに分ける
  const items: Item[] = widgets.flatMap((widget) => {
    const placement = widget.placements.find((p) => p.displayTarget === target);
    return placement ? [{ widget, placement }] : [];
  });
  const pages = Array.from({ length: grid.pages }, (_, i) =>
    items.filter((item) => item.placement.page === i + 1),
  );

  return (
    <div
      ref={ref}
      className={cx("relative size-full", className)}
      style={
        {
          "--scale": metrics?.scale ?? 1,
          // 測り終わるまでは隠す（倍率が決まる前の大きさで一瞬見えないように）
          visibility: metrics ? undefined : "hidden",
        } as CSSProperties
      }
    >
      {items.length === 0 ? (
        <p className="grid size-full place-items-center p-6 text-center text-ink-3">
          この表示先には、まだウィジェットがありません
        </p>
      ) : pages.length === 1 ? (
        <PageGrid items={pages[0] ?? []} target={target} metrics={metrics} />
      ) : (
        <Pager pages={pages} target={target} metrics={metrics} />
      )}
    </div>
  );
}

function PageGrid({
  items,
  target,
  metrics,
}: {
  items: Item[];
  target: DisplayTarget;
  metrics: BoardMetrics | null;
}) {
  const { cols, rows } = GRIDS[target];
  return (
    <div
      className="grid size-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gap: metrics?.gap,
        padding: metrics?.padding,
      }}
    >
      {items.map(({ widget, placement }) => (
        <WidgetCard key={widget.id} widget={widget} placement={placement} />
      ))}
    </div>
  );
}

// スマホ縦の2ページ。横にスワイプしてめくる（スクロールスナップ）。下の点でも移れる
function Pager({
  pages,
  target,
  metrics,
}: {
  pages: Item[][];
  target: DisplayTarget;
  metrics: BoardMetrics | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  // スクロールした位置から、今のページを決める（1フレームに1回だけ計算する）
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setCurrent(Math.round(track.scrollLeft / track.clientWidth));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  function goTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    track.scrollTo({
      left: index * track.clientWidth,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <div className="flex size-full flex-col">
      <div
        ref={trackRef}
        // キーボードの矢印キーでもめくれるように、フォーカスできるようにする
        tabIndex={0}
        aria-label="ボードのページ"
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {pages.map((items, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="ページ"
            aria-label={`${i + 1} / ${pages.length}`}
            className="h-full flex-[0_0_100%] snap-center"
          >
            <PageGrid items={items} target={target} metrics={metrics} />
          </div>
        ))}
      </div>
      <div
        className="flex items-center justify-center gap-2"
        style={{ height: PAGER_HEIGHT }}
      >
        {pages.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1}ページ目へ`}
            aria-current={current === i}
            onClick={() => goTo(i)}
            // 押せる範囲は24px、見える点は小さく
            className="group grid size-6 place-items-center"
          >
            <span className="size-2 rounded-full bg-ink-3 transition-[width] group-aria-[current=true]:w-4 group-aria-[current=true]:bg-ink" />
          </button>
        ))}
      </div>
    </div>
  );
}
