import { Hono } from "hono";
import * as z from "zod";

import {
  displayTargetSchema,
  placementInputSchema,
  updateSettingsSchema,
} from "@/lib/board/schema";

import { requireAuth } from "../middleware/require-auth";
import { requireConsent } from "../middleware/require-consent";
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
  );

export default widgets;
