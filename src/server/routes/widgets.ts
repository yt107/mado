import { Hono } from "hono";
import * as z from "zod";

import {
  createTodoItemSchema,
  displayTargetSchema,
  placementInputSchema,
  putMemoSchema,
  updateSettingsSchema,
} from "@/lib/board/schema";

import {
  calendarEventsQuerySchema,
  createCalendarSubscriptionSchema,
} from "@/lib/widgets/calendar";
import { createNewsFeedSchema } from "@/lib/widgets/news";

import { requireAuth } from "../middleware/require-auth";
import { requireConsent } from "../middleware/require-consent";
import {
  addCalendarSubscription,
  getCalendarEvents,
} from "../services/calendars";
import { addTodoItem, putMemo } from "../services/contents";
import { addNewsFeed, getNewsItems } from "../services/news";
import {
  removePlacement,
  setPlacement,
  updateSettings,
} from "../services/widgets";
import { zValidator } from "../validator";
import { widgetErrorResponse } from "./widget-errors";

const widgetParamSchema = z.object({
  widgetId: z.uuid("ウィジェットの ID が正しくありません"),
});

const placementParamSchema = widgetParamSchema.extend({
  displayTarget: displayTargetSchema,
});

// 編集モードの API（docs/api.md の区切り3）。置くのは /api/boards/:boardId/widgets
const widgets = new Hono()
  // ログインしていて、利用規約に同意した人だけが使える
  .use(requireAuth)
  .use(requireConsent)
  // 設定を変える
  .patch(
    "/:widgetId",
    zValidator("param", widgetParamSchema),
    zValidator("json", updateSettingsSchema),
    async (c) => {
      const result = await updateSettings(
        c.var.user.id,
        c.req.valid("param").widgetId,
        c.req.valid("json").settings,
      );
      return result.ok
        ? c.json(result.value, 200)
        : widgetErrorResponse(c, result.error);
    },
  )
  // 移動とサイズの変更（その表示先にまだなければ、置く）
  .put(
    "/:widgetId/placements/:displayTarget",
    zValidator("param", placementParamSchema),
    zValidator("json", placementInputSchema),
    async (c) => {
      const { widgetId, displayTarget } = c.req.valid("param");
      const result = await setPlacement(
        c.var.user.id,
        widgetId,
        displayTarget,
        c.req.valid("json"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : widgetErrorResponse(c, result.error);
    },
  )
  // 「外す」。その表示先の配置だけ消す
  .delete(
    "/:widgetId/placements/:displayTarget",
    zValidator("param", placementParamSchema),
    async (c) => {
      const { widgetId, displayTarget } = c.req.valid("param");
      const result = await removePlacement(
        c.var.user.id,
        widgetId,
        displayTarget,
      );
      return result.ok
        ? c.body(null, 204)
        : widgetErrorResponse(c, result.error);
    },
  )
  // ToDo の項目を足す（docs/api.md の区切り4）
  .post(
    "/:widgetId/todo-items",
    zValidator("param", widgetParamSchema),
    zValidator("json", createTodoItemSchema),
    async (c) => {
      const result = await addTodoItem(
        c.var.user.id,
        c.req.valid("param").widgetId,
        c.req.valid("json").title,
      );
      return result.ok
        ? c.json(result.value, 201)
        : widgetErrorResponse(c, result.error);
    },
  )
  // メモの本文を保存する
  .put(
    "/:widgetId/memo",
    zValidator("param", widgetParamSchema),
    zValidator("json", putMemoSchema),
    async (c) => {
      const result = await putMemo(
        c.var.user.id,
        c.req.valid("param").widgetId,
        c.req.valid("json").body,
      );
      return result.ok
        ? c.json(result.value, 200)
        : widgetErrorResponse(c, result.error);
    },
  )
  // カレンダーの iCal の URL を登録する（一度読んで、読めたものだけ）
  .post(
    "/:widgetId/calendar-subscriptions",
    zValidator("param", widgetParamSchema),
    zValidator("json", createCalendarSubscriptionSchema),
    async (c) => {
      const result = await addCalendarSubscription(
        c.var.user.id,
        c.req.valid("param").widgetId,
        c.req.valid("json").url,
      );
      return result.ok
        ? c.json(result.value, 201)
        : widgetErrorResponse(c, result.error);
    },
  )
  // 予定を取り出す（サーバーが iCal を読みに行く）
  .get(
    "/:widgetId/calendar-events",
    zValidator("param", widgetParamSchema),
    zValidator("query", calendarEventsQuerySchema),
    async (c) => {
      const { from, to } = c.req.valid("query");
      const result = await getCalendarEvents(
        c.var.user.id,
        c.req.valid("param").widgetId,
        from,
        to,
      );
      return result.ok
        ? c.json(result.value, 200)
        : widgetErrorResponse(c, result.error);
    },
  )
  // ニュースのフィードを登録する（サイトの URL なら、フィードを探す）
  .post(
    "/:widgetId/news-feeds",
    zValidator("param", widgetParamSchema),
    zValidator("json", createNewsFeedSchema),
    async (c) => {
      const result = await addNewsFeed(
        c.var.user.id,
        c.req.valid("param").widgetId,
        c.req.valid("json").url,
      );
      return result.ok
        ? c.json(result.value, 201)
        : widgetErrorResponse(c, result.error);
    },
  )
  // 記事を取り出す（サーバーがフィードを読みに行く）
  .get(
    "/:widgetId/news-items",
    zValidator("param", widgetParamSchema),
    async (c) => {
      const result = await getNewsItems(
        c.var.user.id,
        c.req.valid("param").widgetId,
      );
      return result.ok
        ? c.json(result.value, 200)
        : widgetErrorResponse(c, result.error);
    },
  );

export default widgets;
