import { Hono } from "hono";
import * as z from "zod";

import { updateNewsFeedSchema } from "@/lib/widgets/news";

import { requireAuth } from "../middleware/require-auth";
import { deleteNewsFeed, updateNewsFeed } from "../services/news";
import { zValidator } from "../validator";
import { widgetErrorResponse } from "./widget-errors";

const feedParamSchema = z.object({
  feedId: z.uuid("フィードの ID が正しくありません"),
});

const NOT_FOUND = "フィードが見つかりません";

// ニュースのフィードの API（docs/api.md）。登録するのは /api/widgets/:widgetId/news-feeds
const newsFeeds = new Hono()
  // ログインした人だけが使える
  .use(requireAuth)
  // 名前・表示するか・並び順を変える
  .patch(
    "/:feedId",
    zValidator("param", feedParamSchema),
    zValidator("json", updateNewsFeedSchema),
    async (c) => {
      const result = await updateNewsFeed(
        c.var.user.id,
        c.req.valid("param").feedId,
        c.req.valid("json"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : widgetErrorResponse(c, result.error, NOT_FOUND);
    },
  )
  // 登録をやめる
  .delete("/:feedId", zValidator("param", feedParamSchema), async (c) => {
    const result = await deleteNewsFeed(
      c.var.user.id,
      c.req.valid("param").feedId,
    );
    return result.ok
      ? c.body(null, 204)
      : widgetErrorResponse(c, result.error, NOT_FOUND);
  });

export default newsFeeds;
