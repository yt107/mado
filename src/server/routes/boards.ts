import { Hono } from "hono";
import * as z from "zod";

import { createBoardSchema } from "@/lib/board/schema";

import { requireAuth } from "../middleware/require-auth";
import { requireConsent } from "../middleware/require-consent";
import {
  createBoardFromTemplate,
  getBoardDetail,
  listBoards,
} from "../services/boards";
import { zValidator } from "../validator";

const boardIdParamSchema = z.object({
  boardId: z.uuid("ボードの ID が正しくありません"),
});

const boards = new Hono()
  // ログインしていて、利用規約に同意した人だけが使える
  .use(requireAuth)
  .use(requireConsent)
  // 自分のボードの一覧（MVP では0件か1件）
  .get("/", async (c) => {
    return c.json({ boards: await listBoards(c.var.user.id) }, 200);
  })
  // テンプレートを選んで、ボードを作る
  .post("/", zValidator("json", createBoardSchema), async (c) => {
    const { templateId } = c.req.valid("json");
    const board = await createBoardFromTemplate(c.var.user.id, templateId);
    if (!board) {
      return c.json(
        { error: { code: "conflict", message: "ボードはもうあります" } },
        409,
      );
    }
    return c.json(board, 201);
  })
  // ボードの中身を全部
  .get("/:boardId", zValidator("param", boardIdParamSchema), async (c) => {
    const board = await getBoardDetail(
      c.var.user.id,
      c.req.valid("param").boardId,
    );
    if (!board) {
      return c.json(
        { error: { code: "not_found", message: "ボードが見つかりません" } },
        404,
      );
    }
    return c.json(board, 200);
  });

export default boards;
