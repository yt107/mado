import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ConsentForm } from "@/app/welcome/consent-form";

// 画面の移動と API の呼び出しを、偽物に差し替える
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  postConsent: vi.fn(),
  deleteMe: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/api-client", () => ({
  api: {
    me: {
      consent: { $post: mocks.postConsent },
      $delete: mocks.deleteMe,
    },
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function response(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("ConsentForm", () => {
  test("Google の表示名が、最初から入っている", () => {
    render(<ConsentForm defaultName="Taro Google" />);
    expect(screen.getByLabelText("ユーザー名")).toHaveProperty(
      "value",
      "Taro Google",
    );
  });

  test("同意して送ると、API を呼んで、トップへ移る", async () => {
    mocks.postConsent.mockResolvedValue(response(200, {}));
    render(<ConsentForm defaultName="Taro Google" />);

    fireEvent.change(screen.getByLabelText("ユーザー名"), {
      target: { value: "たろう" },
    });
    fireEvent.click(screen.getByLabelText(/利用規約とプライバシーポリシー/));
    fireEvent.click(screen.getByRole("button", { name: "同意してはじめる" }));

    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
    expect(mocks.postConsent).toHaveBeenCalledWith({
      json: { name: "たろう", agreeToTerms: true },
    });
  });

  test("同意のチェックがなければ、API を呼ばない", () => {
    render(<ConsentForm defaultName="Taro Google" />);
    fireEvent.submit(screen.getByRole("button", { name: "同意してはじめる" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "利用規約に同意してください",
    );
    expect(mocks.postConsent).not.toHaveBeenCalled();
  });

  test("入力が正しくないと言われたら、そのメッセージを出す", async () => {
    mocks.postConsent.mockResolvedValue(
      response(400, {
        error: {
          code: "validation_error",
          message: "ユーザー名を入力してください",
        },
      }),
    );
    render(<ConsentForm defaultName="   " />);

    fireEvent.click(screen.getByLabelText(/利用規約とプライバシーポリシー/));
    fireEvent.click(screen.getByRole("button", { name: "同意してはじめる" }));

    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "ユーザー名を入力してください",
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  test("キャンセルすると、アカウントを削除して、ログインの画面へ移る", async () => {
    mocks.deleteMe.mockResolvedValue(response(204));
    render(<ConsentForm defaultName="Taro Google" />);

    fireEvent.click(
      screen.getByRole("button", { name: "キャンセルしてログアウト" }),
    );

    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login"));
    expect(mocks.deleteMe).toHaveBeenCalled();
  });
});
