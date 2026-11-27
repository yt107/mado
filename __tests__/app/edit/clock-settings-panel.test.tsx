import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ClockSettingsPanel } from "@/app/edit/clock-settings-panel";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderPanel(settings: Record<string, unknown> = {}) {
  render(
    <ClockSettingsPanel
      settings={settings}
      sizeLabel="2×2"
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe("ClockSettingsPanel", () => {
  test("日付の形式の見本は、今日の日付で作る", () => {
    // 2026-11-27 21:00（日本時間）
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-27T12:00:00Z"));
    renderPanel();

    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(
      expect.arrayContaining([
        "11月27日 金曜日",
        "2026年11月27日 金曜日",
        "2026/11/27(金)",
      ]),
    );
  });

  test("見本の日付は、基準のタイムゾーンの日付にする", () => {
    // 日本時間では 11/28 の朝、ニューヨークではまだ 11/27
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-27T23:00:00Z"));
    renderPanel({ city: "new_york" });

    const select = screen.getByLabelText("日付の形式");
    expect(select.textContent).toContain("11月27日 金曜日");
  });

  test("日付と世界時計に、表示される大きさを書く", () => {
    renderPanel();
    expect(
      screen.getByRole("switch", { name: /日付を表示.*横2マス以上で表示/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /世界時計.*2×2 以上で表示/ }),
    ).toBeTruthy();
  });
});
