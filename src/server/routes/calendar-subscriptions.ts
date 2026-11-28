import { Hono } from "hono";
import * as z from "zod";

import { updateCalendarSubscriptionSchema } from "@/lib/widgets/calendar";

import { requireAuth } from "../middleware/require-auth";
import {
  deleteCalendarSubscription,
  updateCalendarSubscription,
} from "../services/calendars";
import { zValidator } from "../validator";
import { widgetErrorResponse } from "./widget-errors";

const subscriptionParamSchema = z.object({
  subscriptionId: z.uuid("カレンダーの ID が正しくありません"),
});

const NOT_FOUND = "カレンダーが見つかりません";

// カレンダーの購読先の API（docs/api.md）。登録するのは /api/widgets/:widgetId/calendar-subscriptions
const calendarSubscriptions = new Hono()
  // ログインした人だけが使える
  .use(requireAuth)
  // 名前と色を変える
  .patch(
    "/:subscriptionId",
    zValidator("param", subscriptionParamSchema),
    zValidator("json", updateCalendarSubscriptionSchema),
    async (c) => {
      const result = await updateCalendarSubscription(
        c.var.user.id,
        c.req.valid("param").subscriptionId,
        c.req.valid("json"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : widgetErrorResponse(c, result.error, NOT_FOUND);
    },
  )
  // 登録をやめる
  .delete(
    "/:subscriptionId",
    zValidator("param", subscriptionParamSchema),
    async (c) => {
      const result = await deleteCalendarSubscription(
        c.var.user.id,
        c.req.valid("param").subscriptionId,
      );
      return result.ok
        ? c.body(null, 204)
        : widgetErrorResponse(c, result.error, NOT_FOUND);
    },
  );

export default calendarSubscriptions;
