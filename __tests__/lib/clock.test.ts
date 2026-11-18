// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  clockSettingsSchema,
  formatClockDate,
  formatShortTime,
  getTimeParts,
  relativeDayLabel,
} from "@/lib/widgets/clock";

// 2026-11-06 10:30:42（東京）
const date = new Date("2026-11-06T01:30:42Z");

describe("clockSettingsSchema", () => {
  test("空の設定は、初期値で埋まる", () => {
    expect(clockSettingsSchema.parse({})).toEqual({
      hourCycle: "24h",
      showSeconds: true,
      showDate: true,
      dateFormat: "monthDayWeekday",
      textStyle: "thin",
      city: "tokyo",
      worldClocks: [],
    });
  });

  test("世界時計は4都市まで", () => {
    const worldClocks = ["london", "paris", "berlin", "seoul", "sydney"];
    expect(clockSettingsSchema.safeParse({ worldClocks }).success).toBe(false);
  });

  test("知らない都市は受け付けない", () => {
    expect(clockSettingsSchema.safeParse({ city: "atlantis" }).success).toBe(
      false,
    );
  });
});

describe("時刻", () => {
  test("24時間", () => {
    expect(getTimeParts(date, "Asia/Tokyo", "24h")).toEqual({
      hours: "10",
      minutes: "30",
      seconds: "42",
      dayPeriod: null,
    });
  });

  test("12時間は午前・午後が付く", () => {
    expect(getTimeParts(date, "America/New_York", "12h")).toEqual({
      hours: "8",
      minutes: "30",
      seconds: "42",
      dayPeriod: "午後",
    });
  });

  test("短い時刻", () => {
    expect(formatShortTime(date, "America/New_York", "24h")).toBe("20:30");
    expect(formatShortTime(date, "Europe/London", "24h")).toBe("01:30");
    expect(formatShortTime(date, "Australia/Sydney", "12h")).toBe("午後12:30");
  });
});

describe("日付", () => {
  test.each([
    ["monthDayWeekday", "11月6日 金曜日"],
    ["yearMonthDayWeekday", "2026年11月6日 金曜日"],
    ["numeric", "2026/11/06(金)"],
  ] as const)("%s は「%s」", (dateFormat, expected) => {
    expect(formatClockDate(date, "Asia/Tokyo", dateFormat)).toBe(expected);
  });

  test("世界時計の日付は、基準の都市から見て前日・今日・翌日", () => {
    expect(relativeDayLabel(date, "Asia/Tokyo", "America/New_York")).toBe(
      "前日",
    );
    expect(relativeDayLabel(date, "Asia/Tokyo", "Europe/London")).toBe("今日");
    expect(relativeDayLabel(date, "Europe/London", "Asia/Tokyo")).toBe("今日");
    expect(relativeDayLabel(date, "America/New_York", "Asia/Tokyo")).toBe(
      "翌日",
    );
  });
});
