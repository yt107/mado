"use client";

import { useRef, useState, type PointerEvent } from "react";

// 設定パネルの一覧（ToDo の項目、ニュースのフィード）を、つまみのドラッグと ↑↓ キーで並べ替える。
// 動かしているあいだは、落とす場所に並べて見せる
export function useDragSort<T extends { id: string }>(
  sorted: T[],
  onMove: (item: T, toIndex: number) => void,
) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ id: string; index: number } | null>(null);

  const ordered = (() => {
    if (!drag) return sorted;
    const moving = sorted.find((item) => item.id === drag.id);
    if (!moving) return sorted;
    const rest = sorted.filter((item) => item.id !== drag.id);
    return [...rest.slice(0, drag.index), moving, ...rest.slice(drag.index)];
  })();

  function indexAt(clientY: number, movingId: string) {
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-item]") ?? [],
    ).filter((row) => row.dataset.item !== movingId);
    // 指より上にある項目の数が、落とす場所の番号
    return rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top + rect.height / 2 < clientY;
    }).length;
  }

  function moveTo(item: T, to: number) {
    if (to < 0 || to >= sorted.length || to === sorted.indexOf(item)) return;
    onMove(item, to);
  }

  // つまみのボタンに付ける
  function handleProps(item: T) {
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ id: item.id, index: sorted.indexOf(item) });
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        if (!drag) return;
        const index = indexAt(event.clientY, drag.id);
        if (index !== drag.index) setDrag({ ...drag, index });
      },
      onLostPointerCapture: () => {
        if (!drag) return;
        const moving = sorted.find((i) => i.id === drag.id);
        if (moving) moveTo(moving, drag.index);
        setDrag(null);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          moveTo(
            item,
            sorted.indexOf(item) + (event.key === "ArrowUp" ? -1 : 1),
          );
        }
      },
    };
  }

  return { listRef, ordered, draggingId: drag?.id ?? null, handleProps };
}
