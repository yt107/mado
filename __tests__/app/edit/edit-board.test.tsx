import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { EditBoard } from "@/app/edit/edit-board";
import type { BoardWidget } from "@/lib/board/schema";

// jsdom には、大きさを測る仕組みとポインターのキャプチャがないので、代わりを置く
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(
        private callback: (entries: { contentRect: DOMRect }[]) => void,
      ) {}
      observe() {
        this.callback([
          { contentRect: { width: 800, height: 600 } as DOMRect },
        ]);
      }
      disconnect() {}
    },
  );
  Element.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const memo: BoardWidget = {
  id: "memo-1",
  type: "memo",
  settings: {},
  placements: [{ displayTarget: "pc", page: 1, x: 0, y: 0, w: 1, h: 1 }],
  memo: null,
};

function renderBoard() {
  const handlers = {
    onSelect: vi.fn(),
    onCommit: vi.fn(),
    onRemove: vi.fn(),
    onOpenSettings: vi.fn(),
    onAnnounce: vi.fn(),
  };
  const { container } = render(
    <EditBoard
      widgets={[memo]}
      target="pc"
      selectedId={null}
      dropPreview={null}
      {...handlers}
    />,
  );
  const widget = screen.getByRole("button", { name: /メモ/ });
  return { container, widget, ...handlers };
}

// 押して、動かして（動かさずに）、離す。最後にブラウザと同じく click が来る
function press(widget: HTMLElement, moveTo?: { x: number; y: number }) {
  fireEvent.pointerDown(widget, { button: 0, clientX: 10, clientY: 10 });
  if (moveTo) {
    fireEvent.pointerMove(widget, { clientX: moveTo.x, clientY: moveTo.y });
  }
  fireEvent.pointerUp(widget);
  fireEvent.lostPointerCapture(widget);
  fireEvent.click(widget);
}

describe("EditBoard", () => {
  test("ドラッグせずにクリックすると、選んで設定を開く", () => {
    const { widget, onSelect, onOpenSettings } = renderBoard();
    press(widget);
    expect(onSelect).toHaveBeenCalledWith("memo-1");
    expect(onOpenSettings).toHaveBeenCalledWith("memo-1");
  });

  test("少し（4px 未満）ぶれても、クリックとして設定を開く", () => {
    const { widget, onOpenSettings } = renderBoard();
    press(widget, { x: 12, y: 12 });
    expect(onOpenSettings).toHaveBeenCalledWith("memo-1");
  });

  test("ドラッグしたあとは、設定を開かない", () => {
    const { widget, onOpenSettings, onAnnounce } = renderBoard();
    press(widget, { x: 60, y: 60 });
    // ドラッグとして扱われた（jsdom ではマスの位置が測れず、置けない場所への移動になる）
    expect(onAnnounce).toHaveBeenCalledWith(
      "そこには置けないので、元の場所に戻しました",
    );
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  test("ドラッグのあとでも、次のクリックでは設定を開く", () => {
    const { widget, onOpenSettings } = renderBoard();
    press(widget, { x: 60, y: 60 });
    press(widget);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  test("ボードの空いているところを押すと、選ぶのをやめる", () => {
    const { container, onSelect } = renderBoard();
    fireEvent.pointerDown(container.firstElementChild!);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
