import { asc } from "drizzle-orm";

import { widgetSchema, type BoardWidget } from "@/lib/board/schema";
import type { WidgetType } from "@/lib/widgets/types";

import { calendarSubscriptions, newsFeeds, todoItems } from "../db/schema";

// ウィジェットを読むときに、一緒に読むもの（配置、ToDo の項目、メモの本文、カレンダーの購読先、フィード）
export const widgetColumns = { id: true, type: true, settings: true } as const;

export const widgetWith = {
  placements: {
    columns: {
      displayTarget: true,
      page: true,
      x: true,
      y: true,
      w: true,
      h: true,
    },
  },
  todoItems: {
    columns: { id: true, title: true, isDone: true, sortOrder: true },
    orderBy: asc(todoItems.sortOrder),
  },
  memo: { columns: { body: true, updatedAt: true } },
  // iCal の URL（暗号化した列）は読まない
  calendarSubscriptions: {
    columns: {
      id: true,
      name: true,
      color: true,
      lastFetchedAt: true,
      lastError: true,
    },
    orderBy: asc(calendarSubscriptions.createdAt),
  },
  newsFeeds: {
    columns: {
      id: true,
      title: true,
      feedUrl: true,
      sortOrder: true,
      visible: true,
      lastFetchedAt: true,
      lastError: true,
    },
    orderBy: asc(newsFeeds.sortOrder),
  },
} as const;

type FetchStatus = { lastFetchedAt: Date | null; lastError: string | null };

function withIsoDates<T extends FetchStatus>(row: T) {
  return { ...row, lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null };
}

type WidgetRow = {
  id: string;
  type: WidgetType;
  settings: unknown;
  placements: BoardWidget["placements"];
  todoItems: NonNullable<BoardWidget["todoItems"]>;
  memo: { body: string; updatedAt: Date } | null;
  calendarSubscriptions: ({
    id: string;
    name: string;
    color: string;
  } & FetchStatus)[];
  newsFeeds: ({
    id: string;
    title: string;
    feedUrl: string;
    sortOrder: number;
    visible: boolean;
  } & FetchStatus)[];
};

// DB から読んだ形を、API が返す形にそろえる。中身はその種類のウィジェットにだけ付ける
export function toBoardWidget(row: WidgetRow): BoardWidget {
  return widgetSchema.parse({
    id: row.id,
    type: row.type,
    settings: row.settings,
    placements: row.placements,
    ...(row.type === "todo" && { todoItems: row.todoItems }),
    ...(row.type === "memo" && {
      memo: row.memo
        ? { body: row.memo.body, updatedAt: row.memo.updatedAt.toISOString() }
        : null,
    }),
    ...(row.type === "calendar" && {
      calendarSubscriptions: row.calendarSubscriptions.map(withIsoDates),
    }),
    ...(row.type === "news" && {
      newsFeeds: row.newsFeeds.map(withIsoDates),
    }),
  });
}
