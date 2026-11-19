import { asc } from "drizzle-orm";

import { widgetSchema, type BoardWidget } from "@/lib/board/schema";
import type { WidgetType } from "@/lib/widgets/types";

import { todoItems } from "../db/schema";

// ウィジェットを読むときに、一緒に読むもの（配置、ToDo の項目、メモの本文）
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
} as const;

type WidgetRow = {
  id: string;
  type: WidgetType;
  settings: unknown;
  placements: BoardWidget["placements"];
  todoItems: NonNullable<BoardWidget["todoItems"]>;
  memo: { body: string; updatedAt: Date } | null;
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
  });
}
