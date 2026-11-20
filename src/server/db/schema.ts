import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
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

// drizzle-kit も読むファイルなので、@/ ではなく相対パスで読み込む
import { DISPLAY_TARGETS } from "../../lib/board/display-targets";
import { WIDGET_TYPES } from "../../lib/widgets/types";
import { users } from "./auth-schema";

// Better Auth のテーブルも、ここからまとめて書き出す（drizzle-kit と db がこのファイルを読むため）
export * from "./auth-schema";

// ウィジェットの種類（er.md の widget_type）。値の一覧は画面と共通
export const widgetType = pgEnum("widget_type", WIDGET_TYPES);

// 表示先（er.md の display_target）。値の一覧は画面と共通
export const displayTarget = pgEnum("display_target", DISPLAY_TARGETS);

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

// ToDo の項目（ToDo のウィジェットにだけ付ける。種類の確認はサービス層でする。docs/er.md）
export const todoItems = pgTable(
  "todo_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    widgetId: uuid("widget_id")
      .notNull()
      .references(() => widgets.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps,
  },
  (table) => [
    // ウィジェットごとに並び順で読む。外部キーのインデックスも兼ねる
    index("todo_items_widget_id_sort_order_idx").on(
      table.widgetId,
      table.sortOrder,
    ),
    check(
      "todo_items_title_length_check",
      sql`char_length(${table.title}) between 1 and 100`,
    ),
  ],
);

// メモの本文（メモのウィジェットに1つ。updated_at は「2時間前」の表示に使う）
export const memos = pgTable(
  "memos",
  {
    widgetId: uuid("widget_id")
      .primaryKey()
      .references(() => widgets.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    check("memos_body_length_check", sql`char_length(${table.body}) <= 500`),
  ],
);

// 暗号化した値を入れる列（PostgreSQL の bytea）。Drizzle に専用の型がないので、自分で定義する。
// Node.js の Buffer ではなく Uint8Array で扱う（Cloudflare Workers でも動くように）
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => new Uint8Array(value),
});

// カレンダーの購読先（カレンダーのウィジェットにだけ付ける。docs/er.md）。
// iCal の URL は、それだけで予定を読める鍵なので、暗号化して保存し、画面には返さない
export const calendarSubscriptions = pgTable(
  "calendar_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    widgetId: uuid("widget_id")
      .notNull()
      .references(() => widgets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    urlEncrypted: bytea("url_encrypted").notNull(),
    color: text("color").notNull(),
    // 最後に読めた日時と、最後に読めなかったときの理由（「10:28 更新」「取得できません」の表示）
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    index("calendar_subscriptions_widget_id_idx").on(table.widgetId),
    check(
      "calendar_subscriptions_name_length_check",
      sql`char_length(${table.name}) between 1 and 50`,
    ),
  ],
);

// ニュースのフィード（ニュースのウィジェットにだけ付ける。docs/er.md）
export const newsFeeds = pgTable(
  "news_feeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    widgetId: uuid("widget_id")
      .notNull()
      .references(() => widgets.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    feedUrl: text("feed_url").notNull(),
    sortOrder: integer("sort_order").notNull(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    // 同じフィードは、1つのウィジェットに1回まで。widget_id で探すときのインデックスも兼ねる
    unique("news_feeds_widget_id_feed_url_unique").on(
      table.widgetId,
      table.feedUrl,
    ),
    check(
      "news_feeds_title_length_check",
      sql`char_length(${table.title}) between 1 and 100`,
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
  todoItems: many(todoItems),
  memo: one(memos),
  calendarSubscriptions: many(calendarSubscriptions),
  newsFeeds: many(newsFeeds),
}));

export const todoItemsRelations = relations(todoItems, ({ one }) => ({
  widget: one(widgets, {
    fields: [todoItems.widgetId],
    references: [widgets.id],
  }),
}));

export const memosRelations = relations(memos, ({ one }) => ({
  widget: one(widgets, { fields: [memos.widgetId], references: [widgets.id] }),
}));

export const calendarSubscriptionsRelations = relations(
  calendarSubscriptions,
  ({ one }) => ({
    widget: one(widgets, {
      fields: [calendarSubscriptions.widgetId],
      references: [widgets.id],
    }),
  }),
);

export const newsFeedsRelations = relations(newsFeeds, ({ one }) => ({
  widget: one(widgets, {
    fields: [newsFeeds.widgetId],
    references: [widgets.id],
  }),
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
