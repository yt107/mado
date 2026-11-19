// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  countdownSettingsSchema,
  countdownState,
  formatCountdownDate,
  localDateString,
} from "@/lib/widgets/countdown";
import { relativeTimeLabel } from "@/lib/widgets/memo";
import { todoSettingsSchema, visibleTodoItems } from "@/lib/widgets/todo";

// 端末の時刻（テストを動かす場所の時刻）で、2026-11-06 10:30 を作る
const now = new Date(2026, 10, 6, 10, 30);

function settings(patch: Record<string, unknown>) {
  return countdownSettingsSchema.parse(patch);
}

describe("カウントダウン", () => {
  test("日付がなければ unset", () => {
    expect(countdownState(now, settings({}))).toEqual({ kind: "unset" });
  });

  test("残りの日数と、進み具合", () => {
    const state = countdownState(
      now,
      settings({ date: "2026-11-21", startDate: "2026-11-01" }),
    );
    // 11/6 から 11/21 まで15日。11/1 から 20日のうち 5日が過ぎた
    expect(state).toMatchObject({ kind: "upcoming", days: 15, progress: 0.25 });
  });

  test("日数と時間：その日の 0時までの残り", () => {
    const state = countdownState(
      now,
      settings({ date: "2026-11-21", unit: "daysHours" }),
    );
    // 11/6 10:30 から 11/21 0:00 まで、14日と13時間30分
    expect(state).toMatchObject({ kind: "upcoming", days: 14, hours: 13 });
  });

  test("当日は today、過ぎたら past", () => {
    expect(countdownState(now, settings({ date: "2026-11-06" }))).toEqual({
      kind: "today",
    });
    expect(countdownState(now, settings({ date: "2026-11-05" }))).toEqual({
      kind: "past",
    });
  });

  test("日付を設定した日がなければ、今日から数える（進み具合は0）", () => {
    expect(countdownState(now, settings({ date: "2026-11-21" }))).toMatchObject(
      { progress: 0 },
    );
  });

  test("日付の書き方", () => {
    expect(formatCountdownDate("2026-11-21")).toBe("11月21日(土)");
    expect(localDateString(now)).toBe("2026-11-06");
  });

  test("イベント名は30文字まで", () => {
    expect(
      countdownSettingsSchema.safeParse({ title: "あ".repeat(31) }).success,
    ).toBe(false);
  });
});

describe("メモの更新の時間", () => {
  test.each([
    [0, "たった今"],
    [5, "5分前"],
    [120, "2時間前"],
    [60 * 24 * 3, "3日前"],
  ])("%i分前は「%s」", (minutes, label) => {
    const from = new Date(now.getTime() - minutes * 60_000);
    expect(relativeTimeLabel(from, now)).toBe(label);
  });
});

describe("ToDo の並び", () => {
  const items = [
    { id: "a", title: "A", isDone: true, sortOrder: 0 },
    { id: "b", title: "B", isDone: false, sortOrder: 1 },
    { id: "c", title: "C", isDone: false, sortOrder: 2 },
  ];
  const titles = (list: { title: string }[]) => list.map((i) => i.title);

  test("初期値では、並び順のまま、完了したものも出す", () => {
    expect(
      titles(visibleTodoItems(items, todoSettingsSchema.parse({}))),
    ).toEqual(["A", "B", "C"]);
  });

  test("完了したものを下にまとめる", () => {
    expect(
      titles(
        visibleTodoItems(
          items,
          todoSettingsSchema.parse({ completedToBottom: true }),
        ),
      ),
    ).toEqual(["B", "C", "A"]);
  });

  test("完了したものを隠す", () => {
    expect(
      titles(
        visibleTodoItems(
          items,
          todoSettingsSchema.parse({ showCompleted: false }),
        ),
      ),
    ).toEqual(["B", "C"]);
  });
});
