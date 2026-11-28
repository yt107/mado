import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { NewsView } from "@/components/widgets/news-widget";
import {
  readNewsSettings,
  type NewsFeed,
  type NewsItem,
} from "@/lib/widgets/news";

afterEach(cleanup);

const now = new Date("2026-11-28T12:00:00+09:00");
const settings = readNewsSettings({});

function feed(id: string, sortOrder: number, visible = true): NewsFeed {
  return {
    id,
    title: `フィード${id}`,
    feedUrl: `https://${id}.example.com/rss`,
    sortOrder,
    visible,
    lastFetchedAt: null,
    lastError: null,
  };
}

function item(feedId: string, n: number): NewsItem {
  return {
    id: `${feedId}-${n}`,
    feedId,
    title: `${feedId}の記事${n}`,
    link: `https://${feedId}.example.com/${n}`,
    publishedAt: new Date(now.getTime() - n * 60_000).toISOString(),
    image: null,
    summary: "",
  };
}

const feeds = [feed("A", 0), feed("B", 1, false), feed("C", 2), feed("D", 3)];
const items = ["A", "B", "C", "D"].flatMap((id) => [item(id, 1), item(id, 2)]);

describe("NewsView", () => {
  test("表示するフィードを、横のマスの数だけ列に並べる", () => {
    render(
      <NewsView
        settings={settings}
        data={{ feeds, items }}
        now={now}
        size={{ w: 2, h: 2 }}
      />,
    );
    // B は隠しているので、A と C の2列
    const columnA = screen.getByRole("region", { name: "フィードA" });
    const columnC = screen.getByRole("region", { name: "フィードC" });
    expect(screen.queryByRole("region", { name: "フィードB" })).toBeNull();
    expect(screen.queryByRole("region", { name: "フィードD" })).toBeNull();
    expect(within(columnA).getByText("Aの記事1")).toBeTruthy();
    expect(within(columnC).getByText("Cの記事2")).toBeTruthy();
    expect(within(columnA).queryByText("Cの記事1")).toBeNull();
  });

  test("列が1つなら、いちばん上のフィードだけを、今までの形で出す", () => {
    render(
      <NewsView
        settings={settings}
        data={{ feeds, items }}
        now={now}
        size={{ w: 1, h: 2 }}
      />,
    );
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText("Aの記事1")).toBeTruthy();
    expect(screen.queryByText("Cの記事1")).toBeNull();
    // 記事の上に、フィードの名前を出す
    expect(screen.getAllByText("フィードA")).toHaveLength(2);
  });

  test("見出しのリンクは、表示モード（openLinks）のときだけ", () => {
    const view = (openLinks: boolean) => (
      <NewsView
        settings={settings}
        data={{ feeds, items }}
        now={now}
        size={{ w: 2, h: 2 }}
        openLinks={openLinks}
      />
    );
    const { rerender } = render(view(false));
    expect(screen.queryAllByRole("link")).toHaveLength(0);

    rerender(view(true));
    const link = screen.getByRole("link", { name: /Aの記事1/ });
    expect(link.getAttribute("href")).toBe("https://A.example.com/1");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("読めなかったフィードの列には、そう出す", () => {
    render(
      <NewsView
        settings={settings}
        data={{
          feeds: [feed("A", 0), { ...feed("C", 1), lastError: "読めません" }],
          items: [item("A", 1)],
        }}
        now={now}
        size={{ w: 2, h: 1 }}
      />,
    );
    const columnC = screen.getByRole("region", { name: "フィードC" });
    expect(
      within(columnC).getByText("記事を読み込めませんでした"),
    ).toBeTruthy();
  });
});
