import { and, asc, count, eq, max, sql } from "drizzle-orm";
import type * as z from "zod";

import type { MemoContent, updateTodoItemSchema } from "@/lib/board/schema";
import { TODO_ITEMS_MAX, type TodoItem } from "@/lib/widgets/todo";
import type { WidgetType } from "@/lib/widgets/types";

import { db } from "../db";
import { boards, memos, todoItems, widgets } from "../db/schema";
import { fail, ok, type Result, type Tx } from "./widgets";

// ウィジェットの中身（ToDo の項目、メモの本文）の処理。
// ウィジェット → ボード → ユーザー とたどって持ち主を確かめ、種類も確かめる（docs/er.md）

const todoColumns = {
  id: todoItems.id,
  title: todoItems.title,
  isDone: todoItems.isDone,
  sortOrder: todoItems.sortOrder,
};

// 自分のウィジェットを、ボードの行をロックしてから読む（同じボードへの編集を1つずつ進める）
async function lockOwnedWidget(tx: Tx, userId: string, widgetId: string) {
  const [row] = await tx
    .select({ id: widgets.id, type: widgets.type })
    .from(widgets)
    .innerJoin(boards, eq(boards.id, widgets.boardId))
    .where(and(eq(widgets.id, widgetId), eq(boards.userId, userId)))
    .for("update", { of: boards });
  return row ?? null;
}

function wrongType(expected: WidgetType) {
  return fail({
    code: "wrong_type",
    message:
      expected === "todo"
        ? "ToDo のウィジェットではありません"
        : "メモのウィジェットではありません",
  });
}

// ToDo の項目を、いちばん下に足す
export async function addTodoItem(
  userId: string,
  widgetId: string,
  title: string,
): Promise<Result<TodoItem>> {
  return db.transaction(async (tx) => {
    const widget = await lockOwnedWidget(tx, userId, widgetId);
    if (!widget) return fail({ code: "not_found" });
    if (widget.type !== "todo") return wrongType("todo");

    const [stats] = await tx
      .select({ total: count(), last: max(todoItems.sortOrder) })
      .from(todoItems)
      .where(eq(todoItems.widgetId, widgetId));
    if ((stats?.total ?? 0) >= TODO_ITEMS_MAX) {
      return fail({
        code: "too_many",
        message: `項目は${TODO_ITEMS_MAX}件までです`,
      });
    }
    const [created] = await tx
      .insert(todoItems)
      .values({ widgetId, title, sortOrder: (stats?.last ?? -1) + 1 })
      .returning(todoColumns);
    if (!created) throw new Error("項目を作れませんでした");
    return ok(created);
  });
}

// 自分の項目を、ボードの行をロックしてから読む
async function lockOwnedItem(tx: Tx, userId: string, itemId: string) {
  const [row] = await tx
    .select({ ...todoColumns, widgetId: todoItems.widgetId })
    .from(todoItems)
    .innerJoin(widgets, eq(widgets.id, todoItems.widgetId))
    .innerJoin(boards, eq(boards.id, widgets.boardId))
    .where(and(eq(todoItems.id, itemId), eq(boards.userId, userId)))
    .for("update", { of: boards });
  return row ?? null;
}

// 項目の文言・完了・並び順を変える。並び順は「何番目（0から）に動かすか」で受け取り、
// ほかの項目の並び順も 0, 1, 2… に振り直す
export async function updateTodoItem(
  userId: string,
  itemId: string,
  patch: z.infer<typeof updateTodoItemSchema>,
): Promise<Result<TodoItem>> {
  return db.transaction(async (tx) => {
    const item = await lockOwnedItem(tx, userId, itemId);
    if (!item) return fail({ code: "not_found" });

    if (patch.title !== undefined || patch.isDone !== undefined) {
      await tx
        .update(todoItems)
        .set({
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.isDone !== undefined && { isDone: patch.isDone }),
        })
        .where(eq(todoItems.id, itemId));
    }

    if (patch.sortOrder !== undefined) {
      const siblings = await tx
        .select({ id: todoItems.id, sortOrder: todoItems.sortOrder })
        .from(todoItems)
        .where(eq(todoItems.widgetId, item.widgetId))
        .orderBy(asc(todoItems.sortOrder), asc(todoItems.createdAt));
      const others = siblings.filter((s) => s.id !== itemId);
      const index = Math.min(patch.sortOrder, others.length);
      const ordered = [
        ...others.slice(0, index),
        { id: itemId, sortOrder: -1 },
        ...others.slice(index),
      ];
      for (const [position, row] of ordered.entries()) {
        if (row.sortOrder !== position) {
          await tx
            .update(todoItems)
            .set({ sortOrder: position })
            .where(eq(todoItems.id, row.id));
        }
      }
    }

    const [saved] = await tx
      .select(todoColumns)
      .from(todoItems)
      .where(eq(todoItems.id, itemId));
    if (!saved) throw new Error("項目が見つかりません");
    return ok(saved);
  });
}

export async function deleteTodoItem(
  userId: string,
  itemId: string,
): Promise<Result<null>> {
  return db.transaction(async (tx) => {
    const item = await lockOwnedItem(tx, userId, itemId);
    if (!item) return fail({ code: "not_found" });
    await tx.delete(todoItems).where(eq(todoItems.id, itemId));
    return ok(null);
  });
}

// メモの本文を保存する（まだなければ作る）
export async function putMemo(
  userId: string,
  widgetId: string,
  body: string,
): Promise<Result<MemoContent>> {
  return db.transaction(async (tx) => {
    const widget = await lockOwnedWidget(tx, userId, widgetId);
    if (!widget) return fail({ code: "not_found" });
    if (widget.type !== "memo") return wrongType("memo");

    const [saved] = await tx
      .insert(memos)
      .values({ widgetId, body })
      .onConflictDoUpdate({
        target: memos.widgetId,
        set: { body, updatedAt: sql`now()` },
      })
      .returning({ body: memos.body, updatedAt: memos.updatedAt });
    if (!saved) throw new Error("メモを保存できませんでした");
    return ok({ body: saved.body, updatedAt: saved.updatedAt.toISOString() });
  });
}
