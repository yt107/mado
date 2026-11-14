import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth-schema";

// Better Auth のテーブルも、ここからまとめて書き出す（drizzle-kit と db がこのファイルを読むため）
export * from "./auth-schema";

// ウィジェットの種類（er.md の widget_type）
export const widgetType = pgEnum("widget_type", [
  "clock",
  "weather",
  "calendar",
  "todo",
  "memo",
  "countdown",
  "news",
]);

// 表示先（er.md の display_target）
export const displayTarget = pgEnum("display_target", [
  "pc",
  "tablet_landscape",
  "tablet_portrait",
  "sub_display",
  "phone_portrait",
  "phone_landscape",
]);

// どのテーブルにも持たせる日時の列（er.md「図に載せていない列」）
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("boards_user_id_idx").on(table.userId)],
);

export const widgets = pgTable(
  "widgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    type: widgetType("type").notNull(),
    settings: jsonb("settings").notNull().default({}),
    ...timestamps,
  },
  (table) => [
    // 同じ種類のウィジェットは、1つのボードに1つまで。board_id で探すときのインデックスも兼ねる
    unique("widgets_board_id_type_unique").on(table.boardId, table.type),
  ],
);

export const widgetPlacements = pgTable(
  "widget_placements",
  {
    widgetId: uuid("widget_id")
      .notNull()
      .references(() => widgets.id, { onDelete: "cascade" }),
    displayTarget: displayTarget("display_target").notNull(),
    page: smallint("page").notNull().default(1),
    x: smallint("x").notNull(),
    y: smallint("y").notNull(),
    w: smallint("w").notNull(),
    h: smallint("h").notNull(),
    ...timestamps,
  },
  (table) => [
    // 表示先ごとに1つ。widget_id で探すときのインデックスも兼ねる
    primaryKey({ columns: [table.widgetId, table.displayTarget] }),
    // page は1から、x と y は0から数える。w と h は1マス以上（docs/api.md）
    check(
      "widget_placements_position_check",
      sql`${table.page} >= 1 and ${table.x} >= 0 and ${table.y} >= 0 and ${table.w} >= 1 and ${table.h} >= 1`,
    ),
  ],
);

export const boardsRelations = relations(boards, ({ one, many }) => ({
  user: one(users, { fields: [boards.userId], references: [users.id] }),
  widgets: many(widgets),
}));

export const widgetsRelations = relations(widgets, ({ one, many }) => ({
  board: one(boards, { fields: [widgets.boardId], references: [boards.id] }),
  placements: many(widgetPlacements),
}));

export const widgetPlacementsRelations = relations(
  widgetPlacements,
  ({ one }) => ({
    widget: one(widgets, {
      fields: [widgetPlacements.widgetId],
      references: [widgets.id],
    }),
  }),
);
