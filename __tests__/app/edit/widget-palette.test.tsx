import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WidgetPalette, type PaletteStatus } from "@/app/edit/widget-palette";
import type { WidgetType } from "@/lib/widgets/types";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const statuses: Partial<Record<WidgetType, PaletteStatus>> = {
  clock: "placed",
  countdown: "unplaced",
};

function renderPalette() {
  const onAdd = vi.fn();
  render(
    <WidgetPalette
      statusOf={(type) => statuses[type] ?? "new"}
      draggingType={null}
      onAdd={onAdd}
      onDragStart={vi.fn()}
      onDragMove={vi.fn()}
      onDragEnd={vi.fn()}
      onCollapse={vi.fn()}
    />,
  );
  return { onAdd };
}

describe("WidgetPalette", () => {
  test("7つの種類を出し、置いてあるものには「配置済み」と出す", () => {
    renderPalette();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    const clock = screen.getByText("時計").closest("li")!;
    expect(clock.textContent).toContain("配置済み");
    // 置いてあるものは、もう追加できない
    expect(
      screen.queryByRole("button", { name: "時計を空いている場所に追加" }),
    ).toBeNull();
  });

  test("外したものには「未配置」と出し、追加できる", () => {
    const { onAdd } = renderPalette();
    const countdown = screen.getByText("カウントダウン").closest("li")!;
    expect(countdown.textContent).toContain("未配置");

    fireEvent.click(
      screen.getByRole("button", {
        name: "カウントダウンを空いている場所に追加",
      }),
    );
    expect(onAdd).toHaveBeenCalledWith("countdown");
  });

  test("まだ使っていない種類は、印なしで追加できる", () => {
    const { onAdd } = renderPalette();
    const news = screen.getByText("ニュース").closest("li")!;
    expect(news.textContent).not.toContain("配置");

    fireEvent.click(
      screen.getByRole("button", { name: "ニュースを空いている場所に追加" }),
    );
    expect(onAdd).toHaveBeenCalledWith("news");
  });
});
