import { and, asc, eq, inArray, max } from "drizzle-orm";
import type * as z from "zod";

import {
  NEWS_FEEDS_MAX,
  NEWS_ITEMS_PER_FEED,
  NEWS_TITLE_MAX,
  newsFeedSchema,
  type NewsFeed,
  type NewsItem,
  type NewsItemsResponse,
  type updateNewsFeedSchema,
} from "@/lib/widgets/news";

import { db } from "../db";
import { boards, newsFeeds, widgets } from "../db/schema";
import { parsePublicUrl, safeFetch } from "../net/safe-fetch";
import {
  FeedParseError,
  findFeedLink,
  looksLikeFeed,
  parseFeed,
} from "../sources/feed";
import { isFetchFailure, toWidgetError } from "./fetch-errors";
import {
  fail,
  findOwnedWidget,
  lockOwnedWidget,
  ok,
  wrongType,
  type Result,
  type Tx,
} from "./widgets";

// ニュースのフィード（RSS・Atom）の登録と、記事の取り出し

const FEED_MAX_BYTES = 2 * 1024 * 1024;
const FEED_ACCEPT =
  "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5";
const feedColumns = {
  id: newsFeeds.id,
  title: newsFeeds.title,
  feedUrl: newsFeeds.feedUrl,
  sortOrder: newsFeeds.sortOrder,
  visible: newsFeeds.visible,
  lastFetchedAt: newsFeeds.lastFetchedAt,
  lastError: newsFeeds.lastError,
};

type FeedRow = {
  id: string;
  title: string;
  feedUrl: string;
  sortOrder: number;
  visible: boolean;
  lastFetchedAt: Date | null;
  lastError: string | null;
};

function toFeed(row: FeedRow): NewsFeed {
  return newsFeedSchema.parse({
    ...row,
    lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null,
  });
}

// 入力された URL から、フィードを読む。サイトのページなら、ページの中からフィードを探す
async function resolveFeed(rawUrl: string) {
  const first = await safeFetch(parsePublicUrl(rawUrl).href, {
    maxBytes: FEED_MAX_BYTES,
    accept: FEED_ACCEPT,
  });
  if (looksLikeFeed(first.text)) {
    return { feedUrl: first.url, feed: parseFeed(first.text, first.url) };
  }
  const link = findFeedLink(first.text, first.url);
  if (!link) {
    throw new FeedParseError();
  }
  const second = await safeFetch(link, {
    maxBytes: FEED_MAX_BYTES,
    accept: FEED_ACCEPT,
  });
  return { feedUrl: second.url, feed: parseFeed(second.text, second.url) };
}

// フィードを登録する。一度読んでみて、RSS・Atom として読めたものだけを、いちばん下に足す
export async function addNewsFeed(
  userId: string,
  widgetId: string,
  rawUrl: string,
): Promise<Result<NewsFeed>> {
  const widget = await findOwnedWidget(userId, widgetId);
  if (!widget) return fail({ code: "not_found" });
  if (widget.type !== "news") return wrongType("news");

  let resolved: Awaited<ReturnType<typeof resolveFeed>>;
  try {
    resolved = await resolveFeed(rawUrl);
  } catch (error) {
    if (!isFetchFailure(error)) throw error;
    if (error instanceof FeedParseError) {
      return fail({
        code: "fetch_failed",
        message: "RSS・Atom のフィードが見つかりませんでした",
      });
    }
    return fail(toWidgetError(error));
  }
  const title = (
    resolved.feed.title ?? new URL(resolved.feedUrl).hostname
  ).slice(0, NEWS_TITLE_MAX);

  return db.transaction(async (tx) => {
    const locked = await lockOwnedWidget(tx, userId, widgetId);
    if (!locked) return fail({ code: "not_found" });

    const existing = await tx
      .select({ feedUrl: newsFeeds.feedUrl })
      .from(newsFeeds)
      .where(eq(newsFeeds.widgetId, widgetId));
    if (existing.some((row) => row.feedUrl === resolved.feedUrl)) {
      return fail({
        code: "duplicate",
        message: "このフィードは、もう登録しています",
      });
    }
    if (existing.length >= NEWS_FEEDS_MAX) {
      return fail({
        code: "too_many",
        message: `フィードは${NEWS_FEEDS_MAX}個までです`,
      });
    }
    const [last] = await tx
      .select({ value: max(newsFeeds.sortOrder) })
      .from(newsFeeds)
      .where(eq(newsFeeds.widgetId, widgetId));
    const [created] = await tx
      .insert(newsFeeds)
      .values({
        widgetId,
        title,
        feedUrl: resolved.feedUrl,
        sortOrder: (last?.value ?? -1) + 1,
        lastFetchedAt: new Date(),
      })
      .returning(feedColumns);
    if (!created) throw new Error("フィードを登録できませんでした");
    return ok(toFeed(created));
  });
}

// 自分のフィードを、ボードの行をロックしてから読む
async function lockOwnedFeed(tx: Tx, userId: string, feedId: string) {
  const [row] = await tx
    .select({ id: newsFeeds.id, widgetId: newsFeeds.widgetId })
    .from(newsFeeds)
    .innerJoin(widgets, eq(widgets.id, newsFeeds.widgetId))
    .innerJoin(boards, eq(boards.id, widgets.boardId))
    .where(and(eq(newsFeeds.id, feedId), eq(boards.userId, userId)))
    .for("update", { of: boards });
  return row ?? null;
}

// 名前・表示するか・並び順を変える。並び順は「何番目（0から）に動かすか」で受け取り、ほかも 0, 1, 2… に振り直す
export async function updateNewsFeed(
  userId: string,
  feedId: string,
  patch: z.infer<typeof updateNewsFeedSchema>,
): Promise<Result<NewsFeed>> {
  return db.transaction(async (tx) => {
    const feed = await lockOwnedFeed(tx, userId, feedId);
    if (!feed) return fail({ code: "not_found" });

    if (patch.title !== undefined || patch.visible !== undefined) {
      await tx
        .update(newsFeeds)
        .set({ title: patch.title, visible: patch.visible })
        .where(eq(newsFeeds.id, feedId));
    }
    if (patch.sortOrder !== undefined) {
      const siblings = await tx
        .select({ id: newsFeeds.id, sortOrder: newsFeeds.sortOrder })
        .from(newsFeeds)
        .where(eq(newsFeeds.widgetId, feed.widgetId))
        .orderBy(asc(newsFeeds.sortOrder), asc(newsFeeds.createdAt));
      const others = siblings.filter((s) => s.id !== feedId);
      const index = Math.min(patch.sortOrder, others.length);
      const ordered = [
        ...others.slice(0, index),
        { id: feedId, sortOrder: -1 },
        ...others.slice(index),
      ];
      for (const [position, row] of ordered.entries()) {
        if (row.sortOrder !== position) {
          await tx
            .update(newsFeeds)
            .set({ sortOrder: position })
            .where(eq(newsFeeds.id, row.id));
        }
      }
    }

    const [saved] = await tx
      .select(feedColumns)
      .from(newsFeeds)
      .where(eq(newsFeeds.id, feedId));
    if (!saved) throw new Error("フィードが見つかりません");
    return ok(toFeed(saved));
  });
}

export async function deleteNewsFeed(
  userId: string,
  feedId: string,
): Promise<Result<null>> {
  return db.transaction(async (tx) => {
    if (!(await lockOwnedFeed(tx, userId, feedId))) {
      return fail({ code: "not_found" });
    }
    await tx.delete(newsFeeds).where(eq(newsFeeds.id, feedId));
    return ok(null);
  });
}

// 新しい順。日時のない記事は、フィードに書かれた順のまま後ろに置く
function newestFirst(items: NewsItem[]): NewsItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const at = a.item.publishedAt;
      const bt = b.item.publishedAt;
      if (at && bt) return bt.localeCompare(at);
      if (at) return -1;
      if (bt) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

// 表示するフィードを並び順に読み、フィードごとに新しい記事を返す。隠したフィードは読まない。
// 読めなかったフィードは理由を残す
// feedIds を渡したら、そのフィードを読む（ほかのウィジェットのものは無視する）。
// 渡さなければ、表示にしているフィードを読む（feedIds を送らない、前のバージョンの画面のため）
export async function getNewsItems(
  userId: string,
  widgetId: string,
  feedIds?: string[],
): Promise<Result<NewsItemsResponse>> {
  const widget = await findOwnedWidget(userId, widgetId);
  if (!widget) return fail({ code: "not_found" });
  if (widget.type !== "news") return wrongType("news");

  const rows = await db
    .select(feedColumns)
    .from(newsFeeds)
    .where(
      and(
        eq(newsFeeds.widgetId, widgetId),
        feedIds ? inArray(newsFeeds.id, feedIds) : eq(newsFeeds.visible, true),
      ),
    )
    .orderBy(asc(newsFeeds.sortOrder));

  const results = await Promise.all(
    rows.map(async (row) => {
      try {
        const res = await safeFetch(row.feedUrl, {
          maxBytes: FEED_MAX_BYTES,
          accept: FEED_ACCEPT,
        });
        const parsed = parseFeed(res.text, res.url);
        const status = { lastFetchedAt: new Date(), lastError: null };
        await db.update(newsFeeds).set(status).where(eq(newsFeeds.id, row.id));
        // 同じリンクの記事が1つのフィードに2回あっても、ID が重ならないようにする
        const links = new Set<string>();
        const items = newestFirst(
          parsed.entries
            .filter((entry) => !links.has(entry.link) && links.add(entry.link))
            .map((entry) => ({
              id: `${row.id}:${entry.link}`,
              feedId: row.id,
              ...entry,
            })),
        ).slice(0, NEWS_ITEMS_PER_FEED);
        return { feed: toFeed({ ...row, ...status }), items };
      } catch (error) {
        if (!isFetchFailure(error)) throw error;
        const lastError = error.message;
        await db
          .update(newsFeeds)
          .set({ lastError })
          .where(eq(newsFeeds.id, row.id));
        return { feed: toFeed({ ...row, lastError }), items: [] };
      }
    }),
  );

  return ok({
    feeds: results.map((result) => result.feed),
    items: results.flatMap((result) => result.items),
  });
}
