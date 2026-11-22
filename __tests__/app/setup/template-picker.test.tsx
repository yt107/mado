import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { TemplatePicker } from "@/app/setup/template-picker";

// 画面の移動と API の呼び出しを、偽物に差し替える
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  postBoard: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/api-client", () => ({
  api: { boards: { $post: mocks.postBoard } },
}));

// jsdom には ResizeObserver がないので、何もしないものを置く（プレビューが使う）
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function response(status: number) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) };
}

describe("TemplatePicker", () => {
  test("最初はベーシックが選ばれている", () => {
    render(<TemplatePicker />);
    expect(screen.getByRole("radio", { name: /ベーシック/ })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("heading", { name: "ベーシック" })).toBeTruthy();
  });

  test("天気のあるテンプレートは、地域を選んでから作る", async () => {
    mocks.postBoard.mockResolvedValue(response(201));
    // 端末の現在地を、偽物に差し替える
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 35.681236, longitude: 139.767125 },
          } as GeolocationPosition),
      },
    });
    render(<TemplatePicker />);

    fireEvent.click(screen.getByRole("radio", { name: /スタンバイ/ }));
    expect(screen.getByRole("heading", { name: "スタンバイ" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "次へ（天気の地域）" }));

    expect(screen.getByRole("heading", { name: "天気の地域" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    fireEvent.click(
      screen.getByRole("button", { name: "ダッシュボードを作成" }),
    );

    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
    expect(mocks.postBoard).toHaveBeenCalledWith({
      json: {
        templateId: "standby",
        location: {
          name: "現在地",
          region: "",
          latitude: 35.68,
          longitude: 139.77,
        },
      },
    });
  });

  test("地域でスキップすると、地域なしで作る", async () => {
    mocks.postBoard.mockResolvedValue(response(201));
    render(<TemplatePicker />);

    fireEvent.click(screen.getByRole("button", { name: "次へ（天気の地域）" }));
    fireEvent.click(screen.getByRole("button", { name: "スキップ" }));

    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
    expect(mocks.postBoard).toHaveBeenCalledWith({
      json: { templateId: "basic" },
    });
  });

  test("スキップすると、白紙のボードで始める", async () => {
    mocks.postBoard.mockResolvedValue(response(201));
    render(<TemplatePicker />);

    fireEvent.click(screen.getByRole("button", { name: "スキップ" }));

    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
    expect(mocks.postBoard).toHaveBeenCalledWith({
      json: { templateId: "blank" },
    });
  });

  test("もうボードがあれば（409）、そのまま表示モードへ", async () => {
    mocks.postBoard.mockResolvedValue(response(409));
    render(<TemplatePicker />);
    // 白紙のテンプレートには天気がないので、地域を選ばずにすぐ作る
    fireEvent.click(screen.getByRole("radio", { name: /白紙/ }));

    fireEvent.click(
      screen.getByRole("button", { name: "このテンプレートで始める" }),
    );

    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
  });

  test("うまくいかなければ、メッセージを出して移らない", async () => {
    mocks.postBoard.mockResolvedValue(response(500));
    render(<TemplatePicker />);
    fireEvent.click(screen.getByRole("radio", { name: /白紙/ }));

    fireEvent.click(
      screen.getByRole("button", { name: "このテンプレートで始める" }),
    );

    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "うまくいきませんでした。時間をおいて、もう一度お試しください",
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
