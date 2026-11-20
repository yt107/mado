"use client";

import { Newspaper, Rss } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api-client";
import { sampleNews } from "@/lib/board/sample-remote";
import type { BoardWidget } from "@/lib/board/schema";
import { cx } from "@/lib/cx";
import { useNow } from "@/lib/hooks/use-now";
import { useRemoteData, type RemoteData } from "@/lib/hooks/use-remote-data";
import {
  dedupeItems,
  feedColor,
  NEWS_ROTATE_MS,
  newsCount,
  publishedLabel,
  readNewsSettings,
  type NewsFeed,
  type NewsItem,
  type NewsItemsResponse,
  type NewsSettings,
} from "@/lib/widgets/news";

import { RemoteStatus } from "./remote-status";
import { useSampleMode } from "./sample-mode";

type Size = { w: number; h: number };

type ColoredFeed = NewsFeed & { color: string };

// ニュース・RSS（画面設計「ニュース・RSS（サイズ別・状態別）」）。
// 登録したフィードの見出しを、新しい順にまとめて出す。記事は、サーバーがフィードを読んで返す
export function NewsWidget({
  widget,
  size,
}: {
  widget: BoardWidget;
  size: Size;
}) {
  const settings = readNewsSettings(widget.settings);
  const now = useNow();
  const sample = useSampleMode();
  if (!now) return null;
  return sample ? (
    <NewsView
      settings={settings}
      data={sampleNews(now)}
      now={now}
      size={size}
    />
  ) : (
    <LiveNews widget={widget} settings={settings} now={now} size={size} />
  );
}

async function loadItems(widgetId: string): Promise<NewsItemsResponse> {
  const res = await api.widgets[":widgetId"]["news-items"].$get({
    param: { widgetId },
  });
  if (!res.ok) {
    throw new Error("記事を読み込めませんでした");
  }
  return res.json();
}

function LiveNews({
  widget,
  settings,
  now,
  size,
}: {
  widget: BoardWidget;
  settings: NewsSettings;
  now: Date;
  size: Size;
}) {
  const feeds = widget.newsFeeds ?? [];
  // フィードを足したり消したりしたら、すぐ読み直す
  const key = feeds.length > 0 ? feeds.map((feed) => feed.id).join(",") : null;
  const state = useRemoteData(
    key,
    () => loadItems(widget.id),
    settings.refreshMinutes * 60_000,
  );

  if (feeds.length === 0) {
    return <EmptyFeeds />;
  }
  return (
    <NewsView
      settings={settings}
      // フィードの名前と並び順は、ボードの値（編集ですぐ変わる）を使う
      data={{ feeds, items: state.data?.items ?? [] }}
      now={now}
      size={size}
      state={state}
    />
  );
}

function EmptyFeeds() {
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center gap-[0.6em] text-center">
        <span className="grid size-[2.6em] place-items-center rounded-full bg-raised text-ink-3">
          <Rss aria-hidden className="size-[1.2em]" />
        </span>
        <p className="font-bold">フィードが未登録です</p>
        <p className="text-[0.85em] leading-relaxed text-ink-3">
          編集モードでこのウィジェットの設定を開き、RSS / Atom の URL
          を追加してください
        </p>
      </div>
    </div>
  );
}

function Header({ state }: { state?: RemoteData<NewsItemsResponse> }) {
  return (
    <div className="flex items-center justify-between gap-[0.5em]">
      <p className="flex items-center gap-[0.4em] font-bold">
        <Newspaper aria-hidden className="size-[1.05em]" />
        ニュース
      </p>
      {state && <RemoteStatus state={state} className="text-ink-3" />}
    </div>
  );
}

type ViewProps = {
  settings: NewsSettings;
  data: NewsItemsResponse;
  now: Date;
  size: Size;
  state?: RemoteData<NewsItemsResponse>;
};

export function NewsView({ settings, data, now, size, state }: ViewProps) {
  // フィードの色は、並び順の何番目かで決める（設定パネルの印と同じ色）
  const feeds = new Map(
    [...data.feeds]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((feed, index) => [feed.id, { ...feed, color: feedColor(index) }]),
  );
  const all = settings.dedupe ? dedupeItems(data.items) : data.items;
  const items = all.slice(0, newsCount(settings.count, size.w, size.h));

  let body;
  if (state?.loading) {
    body = <Skeleton />;
  } else if (items.length === 0) {
    body = (
      <p className="mt-[0.8em] text-[0.9em] text-ink-3">
        {state?.error ? "記事を読み込めませんでした" : "記事がありません"}
      </p>
    );
  } else if (size.w === 1 && size.h === 1) {
    body = (
      <Rotating
        items={items}
        feeds={feeds}
        now={now}
        rotate={settings.autoRotate}
      />
    );
  } else if (
    size.w >= 2 &&
    size.h >= 2 &&
    settings.showImages &&
    items[0]?.image
  ) {
    body = <WithTopStory items={items} feeds={feeds} now={now} />;
  } else {
    body = (
      <ItemList
        items={items}
        feeds={feeds}
        now={now}
        // 1行の高さのときは、見出しを1行にする（画面設計：2×1 は3件・1行）
        singleLine={size.h === 1}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header state={state} />
      <div className="mt-[0.6em] flex min-h-0 flex-1 flex-col">{body}</div>
    </div>
  );
}

function Source({
  feed,
  publishedAt,
  now,
}: {
  feed: ColoredFeed | undefined;
  publishedAt: string | null;
  now: Date;
}) {
  return (
    <p className="flex min-w-0 items-center gap-[0.4em] text-[0.75em] text-ink-3">
      <span
        aria-hidden
        className="size-[0.6em] shrink-0 rounded-[0.15em]"
        style={{ backgroundColor: feed?.color ?? feedColor(0) }}
      />
      <span className="truncate">{feed?.title ?? "ニュース"}</span>
      {publishedAt && (
        <span className="shrink-0">・{publishedLabel(publishedAt, now)}</span>
      )}
    </p>
  );
}

function ItemList({
  items,
  feeds,
  now,
  singleLine = false,
}: {
  items: NewsItem[];
  feeds: Map<string, ColoredFeed>;
  now: Date;
  singleLine?: boolean;
}) {
  return (
    <ul className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {items.map((item) => (
        <li
          key={item.id}
          className="border-b border-line py-[0.55em] first:pt-0 last:border-b-0"
        >
          <Source
            feed={feeds.get(item.feedId)}
            publishedAt={item.publishedAt}
            now={now}
          />
          <p
            className={cx(
              "mt-[0.2em] font-medium",
              singleLine ? "truncate" : "line-clamp-2",
            )}
          >
            {item.title}
          </p>
        </li>
      ))}
    </ul>
  );
}

// 2×2 以上で画像があるとき：画像つきのトップ記事と、ほかの見出し
function WithTopStory({
  items,
  feeds,
  now,
}: {
  items: NewsItem[];
  feeds: Map<string, ColoredFeed>;
  now: Date;
}) {
  const [top, ...rest] = items;
  if (!top) return null;
  return (
    <div className="flex min-h-0 flex-1 gap-[1.2em]">
      <div className="flex w-1/2 min-w-0 flex-col">
        {top.image && (
          // 外のサイトの画像。送り元のページを相手に伝えない
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={top.image}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            className="aspect-[16/10] w-full rounded-[0.6em] object-cover"
          />
        )}
        <div className="mt-[0.7em]">
          <Source
            feed={feeds.get(top.feedId)}
            publishedAt={top.publishedAt}
            now={now}
          />
        </div>
        <p className="mt-[0.3em] line-clamp-3 text-[1.25em] leading-snug font-bold">
          {top.title}
        </p>
        {top.summary && (
          <p className="mt-[0.4em] line-clamp-3 text-[0.85em] leading-relaxed text-ink-3">
            {top.summary}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <ItemList items={rest} feeds={feeds} now={now} />
      </div>
    </div>
  );
}

// 1×1：見出しを1件ずつ、10秒ごとに切り替える
function Rotating({
  items,
  feeds,
  now,
  rotate,
}: {
  items: NewsItem[];
  feeds: Map<string, ColoredFeed>;
  now: Date;
  rotate: boolean;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!rotate || items.length < 2) return;
    const timer = setInterval(
      () => setIndex((current) => current + 1),
      NEWS_ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [rotate, items.length]);

  const position = index % items.length;
  const item = items[position];
  if (!item) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Source
        feed={feeds.get(item.feedId)}
        publishedAt={item.publishedAt}
        now={now}
      />
      <p
        aria-live="off"
        className="mt-[0.3em] line-clamp-3 text-[1.25em] leading-snug font-bold"
      >
        {item.title}
      </p>
      {rotate && items.length > 1 && (
        <div aria-hidden className="mt-auto flex items-center gap-[0.3em]">
          {items.map((other, i) => (
            <span
              key={other.id}
              className={cx(
                "h-[0.3em] rounded-full",
                i === position ? "w-[1.2em] bg-ink-3" : "w-[0.3em] bg-line",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-[1.2em]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-[0.4em]">
          <span className="h-[0.6em] w-1/3 rounded-full bg-raised" />
          <span className="h-[0.8em] w-full rounded-full bg-raised" />
          <span className="h-[0.8em] w-2/3 rounded-full bg-raised" />
        </div>
      ))}
    </div>
  );
}
