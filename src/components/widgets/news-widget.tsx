"use client";

import { EyeOff, Newspaper, Rss, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api-client";
import { sampleNews } from "@/lib/board/sample-remote";
import type { BoardWidget } from "@/lib/board/schema";
import { cx } from "@/lib/cx";
import { useNow } from "@/lib/hooks/use-now";
import { useRemoteData, type RemoteData } from "@/lib/hooks/use-remote-data";
import {
  itemsOfFeeds,
  NEWS_ROTATE_MS,
  newsColumns,
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

// ニュース・RSS（画面設計「ニュース・RSS（サイズ別・状態別）」）。
// 表示するフィードを、横1マスにつき1列で並べる。記事は、サーバーがフィードを読んで返す。
// openLinks（表示モード）なら、見出しを押すと元の記事を新しいタブで開く
export function NewsWidget({
  widget,
  size,
  openLinks = false,
}: {
  widget: BoardWidget;
  size: Size;
  openLinks?: boolean;
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
    <LiveNews
      widget={widget}
      settings={settings}
      now={now}
      size={size}
      openLinks={openLinks}
    />
  );
}

async function loadItems(
  widgetId: string,
  feedIds: string[],
): Promise<NewsItemsResponse> {
  const res = await api.widgets[":widgetId"]["news-items"].$get({
    param: { widgetId },
    query: { feeds: feedIds.join(",") },
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
  openLinks,
}: {
  widget: BoardWidget;
  settings: NewsSettings;
  now: Date;
  size: Size;
  openLinks: boolean;
}) {
  const feeds = widget.newsFeeds ?? [];
  const visible = feeds.filter((feed) => feed.visible);
  // 表示するフィードが変わったら（足す、消す、隠す、出す）、すぐ読み直す。並べ替えだけなら読み直さない。
  // 読むフィードは画面から伝える（表示・非表示の保存が終わる前に読み直しても、記事が欠けないように）
  const visibleIds = visible.map((feed) => feed.id).toSorted();
  const key = visibleIds.length > 0 ? visibleIds.join(",") : null;
  const state = useRemoteData(
    key,
    () => loadItems(widget.id, visibleIds),
    settings.refreshMinutes * 60_000,
  );

  if (feeds.length === 0) {
    return (
      <EmptyFeeds
        icon={Rss}
        title="フィードが未登録です"
        message="編集モードでこのウィジェットの設定を開き、RSS / Atom の URL を追加してください"
      />
    );
  }
  if (visible.length === 0) {
    return (
      <EmptyFeeds
        icon={EyeOff}
        title="表示するフィードがありません"
        message="編集モードでこのウィジェットの設定を開き、出したいフィードを表示にしてください"
      />
    );
  }

  // フィードの名前と並び順は、ボードの値（編集ですぐ変わる）を使う。
  // 読めたかどうかは、読み直した結果を使う（全体が読めなかったときは、どの列も読めなかったことにする）
  const fetched = new Map(state.data?.feeds.map((feed) => [feed.id, feed]));
  const failed = state.data === null ? state.error : null;
  const shown = visible.map((feed) => ({
    ...feed,
    lastError: failed ?? fetched.get(feed.id)?.lastError ?? null,
  }));
  return (
    <NewsView
      settings={settings}
      // 記事も、ボードにあるフィードのものだけを出す（消したフィードの記事が残らないように）
      data={{
        feeds: shown,
        items: itemsOfFeeds(state.data?.items ?? [], shown),
      }}
      now={now}
      size={size}
      state={state}
      openLinks={openLinks}
    />
  );
}

function EmptyFeeds({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center gap-[0.6em] text-center">
        <span className="grid size-[2.6em] place-items-center rounded-full bg-raised text-ink-3">
          <Icon aria-hidden className="size-[1.2em]" />
        </span>
        <p className="font-bold">{title}</p>
        <p className="text-[0.85em] leading-relaxed text-ink-3">{message}</p>
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
  openLinks?: boolean;
};

export function NewsView({
  settings,
  data,
  now,
  size,
  state,
  openLinks = false,
}: ViewProps) {
  const columns = newsColumns(data.feeds, size.w);
  const count = newsCount(settings.count, size.w, size.h);
  const itemsOf = (feed: NewsFeed) =>
    data.items.filter((item) => item.feedId === feed.id).slice(0, count);
  const [single] = columns;

  let body;
  if (state?.loading) {
    body = <Skeleton />;
  } else if (columns.length === 1 && single) {
    body = (
      <SingleColumn
        feed={single}
        items={itemsOf(single)}
        settings={settings}
        now={now}
        size={size}
        openLinks={openLinks}
      />
    );
  } else if (columns.length > 1) {
    body = (
      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        }}
      >
        {columns.map((feed) => (
          <FeedColumn
            key={feed.id}
            feed={feed}
            items={itemsOf(feed)}
            now={now}
            // 1行の高さのときは、見出しを1行にする（画面設計：2×1 は3件・1行）
            singleLine={size.h === 1}
            openLinks={openLinks}
          />
        ))}
      </div>
    );
  } else {
    body = <EmptyText>記事がありません</EmptyText>;
  }

  return (
    <div className="flex h-full flex-col">
      <Header state={state} />
      <div className="mt-[0.6em] flex min-h-0 flex-1 flex-col">{body}</div>
    </div>
  );
}

function EmptyText({ children }: { children: string }) {
  return <p className="mt-[0.2em] text-[0.9em] text-ink-3">{children}</p>;
}

function emptyMessage(feed: NewsFeed) {
  return feed.lastError ? "記事を読み込めませんでした" : "記事がありません";
}

// 列が1つのとき：1×1 は見出しの切り替え、2×2 以上で画像があれば画像つきのトップ記事、ほかは見出しの一覧
function SingleColumn({
  feed,
  items,
  settings,
  now,
  size,
  openLinks,
}: {
  feed: NewsFeed;
  items: NewsItem[];
  settings: NewsSettings;
  now: Date;
  size: Size;
  openLinks: boolean;
}) {
  if (items.length === 0) {
    return <EmptyText>{emptyMessage(feed)}</EmptyText>;
  }
  if (size.w === 1 && size.h === 1) {
    return (
      <Rotating
        items={items}
        feed={feed}
        now={now}
        rotate={settings.autoRotate}
        openLinks={openLinks}
      />
    );
  }
  if (size.w >= 2 && size.h >= 2 && settings.showImages && items[0]?.image) {
    return (
      <WithTopStory items={items} feed={feed} now={now} openLinks={openLinks} />
    );
  }
  return (
    <ItemList
      items={items}
      feed={feed}
      now={now}
      singleLine={size.h === 1}
      openLinks={openLinks}
    />
  );
}

// 列が2つ以上のとき：列の上にフィードの名前を出し、その下に見出しを並べる
function FeedColumn({
  feed,
  items,
  now,
  singleLine,
  openLinks,
}: {
  feed: NewsFeed;
  items: NewsItem[];
  now: Date;
  singleLine: boolean;
  openLinks: boolean;
}) {
  return (
    <section
      aria-label={feed.title}
      className="flex min-w-0 flex-col border-l border-line pl-[0.9em] not-first:ml-[0.9em] first:border-l-0 first:pl-0"
    >
      <p className="mb-[0.4em] truncate text-[0.8em] font-bold text-ink-2">
        {feed.title}
      </p>
      {items.length === 0 ? (
        <EmptyText>{emptyMessage(feed)}</EmptyText>
      ) : (
        <ItemList
          items={items}
          now={now}
          singleLine={singleLine}
          openLinks={openLinks}
        />
      )}
    </section>
  );
}

// 記事の上の小さい行。列の上にフィードの名前を出しているときは、時刻だけ
function Meta({
  feed,
  publishedAt,
  now,
}: {
  feed?: NewsFeed;
  publishedAt: string | null;
  now: Date;
}) {
  if (!feed && !publishedAt) return null;
  return (
    <p className="flex min-w-0 items-center text-[0.75em] text-ink-3">
      {feed && <span className="truncate">{feed.title}</span>}
      {publishedAt && (
        <span className="shrink-0">
          {feed && "・"}
          {publishedLabel(publishedAt, now)}
        </span>
      )}
    </p>
  );
}

// 見出し。表示モードでは、元の記事へのリンクにする。
// リンクの当たる範囲は、記事のまとまり全体（relative を付けた親）に広げる
function Headline({
  item,
  openLinks,
  className,
}: {
  item: NewsItem;
  openLinks: boolean;
  className: string;
}) {
  if (!openLinks) {
    return <p className={className}>{item.title}</p>;
  }
  return (
    <p className={className}>
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="after:absolute after:inset-0 hover:underline"
      >
        {item.title}
        <span className="sr-only">（新しいタブで開く）</span>
      </a>
    </p>
  );
}

function ItemList({
  items,
  feed,
  now,
  singleLine = false,
  openLinks,
}: {
  items: NewsItem[];
  feed?: NewsFeed;
  now: Date;
  singleLine?: boolean;
  openLinks: boolean;
}) {
  return (
    <ul className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {items.map((item) => (
        <li
          key={item.id}
          className="relative border-b border-line py-[0.55em] first:pt-0 last:border-b-0"
        >
          <Meta feed={feed} publishedAt={item.publishedAt} now={now} />
          <Headline
            item={item}
            openLinks={openLinks}
            className={cx(
              "mt-[0.2em] font-medium",
              singleLine ? "truncate" : "line-clamp-2",
            )}
          />
        </li>
      ))}
    </ul>
  );
}

// 2×2 以上で画像があるとき：画像つきのトップ記事と、ほかの見出し
function WithTopStory({
  items,
  feed,
  now,
  openLinks,
}: {
  items: NewsItem[];
  feed: NewsFeed;
  now: Date;
  openLinks: boolean;
}) {
  const [top, ...rest] = items;
  if (!top) return null;
  return (
    <div className="flex min-h-0 flex-1 gap-[1.2em]">
      <div className="relative flex w-1/2 min-w-0 flex-col">
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
          <Meta feed={feed} publishedAt={top.publishedAt} now={now} />
        </div>
        <Headline
          item={top}
          openLinks={openLinks}
          className="mt-[0.3em] line-clamp-3 text-[1.25em] leading-snug font-bold"
        />
        {top.summary && (
          <p className="mt-[0.4em] line-clamp-3 text-[0.85em] leading-relaxed text-ink-3">
            {top.summary}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <ItemList items={rest} feed={feed} now={now} openLinks={openLinks} />
      </div>
    </div>
  );
}

// 1×1：見出しを1件ずつ、10秒ごとに切り替える
function Rotating({
  items,
  feed,
  now,
  rotate,
  openLinks,
}: {
  items: NewsItem[];
  feed: NewsFeed;
  now: Date;
  rotate: boolean;
  openLinks: boolean;
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <Meta feed={feed} publishedAt={item.publishedAt} now={now} />
      <div aria-live="off">
        <Headline
          item={item}
          openLinks={openLinks}
          className="mt-[0.3em] line-clamp-3 text-[1.25em] leading-snug font-bold"
        />
      </div>
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
