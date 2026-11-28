import { Hono } from "hono";
import * as z from "zod";

import { updateTodoItemSchema } from "@/lib/board/schema";

import { requireAuth } from "../middleware/require-auth";
import { deleteTodoItem, updateTodoItem } from "../services/contents";
import { zValidator } from "../validator";
import { widgetErrorResponse } from "./widget-errors";

const itemParamSchema = z.object({
  itemId: z.uuid("項目の ID が正しくありません"),
});

// ToDo の項目の API（docs/api.md の区切り4）。足すのは /api/widgets/:widgetId/todo-items
const todoItems = new Hono()
  // ログインした人だけが使える
  .use(requireAuth)
  // 文言・完了・並び順を変える（表示モードのチェックもこれを使う）
  .patch(
    "/:itemId",
    zValidator("param", itemParamSchema),
    zValidator("json", updateTodoItemSchema),
    async (c) => {
      const result = await updateTodoItem(
        c.var.user.id,
        c.req.valid("param").itemId,
        c.req.valid("json"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : widgetErrorResponse(c, result.error, "項目が見つかりません");
    },
  )
  .delete("/:itemId", zValidator("param", itemParamSchema), async (c) => {
    const result = await deleteTodoItem(
      c.var.user.id,
      c.req.valid("param").itemId,
    );
    return result.ok
      ? c.body(null, 204)
      : widgetErrorResponse(c, result.error, "項目が見つかりません");
  });

export default todoItems;
