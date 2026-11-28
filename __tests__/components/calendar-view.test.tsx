import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { CalendarView } from "@/components/widgets/calendar-widget";
import { readCalendarSettings } from "@/lib/widgets/calendar";

afterEach(cleanup);

const now = new Date("2026-11-28T12:00:00+09:00");
const settings = readCalendarSettings({});
const data = { subscriptions: [], events: [] };
const openUrl =
  "https://calendar.google.com/calendar/r?authuser=taro%40gmail.com";

describe("CalendarView", () => {
  test("開く URL があれば、Google カレンダーを新しいタブで開くリンクを置く", () => {
    render(
      <CalendarView
        settings={settings}
        data={data}
        now={now}
        size={{ w: 2, h: 2 }}
        openUrl={openUrl}
      />,
    );
    const link = screen.getByRole("link", {
      name: "Google カレンダーを開く（新しいタブで開く）",
    });
    expect(link.getAttribute("href")).toBe(openUrl);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("開く URL がなければ、リンクにしない（編集モード、Google 以外のカレンダー）", () => {
    render(
      <CalendarView
        settings={settings}
        data={data}
        now={now}
        size={{ w: 2, h: 2 }}
        openUrl={null}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});
