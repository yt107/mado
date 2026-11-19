import { and, eq } from "drizzle-orm";
import type * as z from "zod";

import { GRIDS, type DisplayTarget } from "@/lib/board/display-targets";
import { fitsGrid, overlaps } from "@/lib/board/layout";
import {
  placementSchema,
  type BoardWidget,
  type placeWidgetSchema,
} from "@/lib/board/schema";
import type { Placement } from "@/lib/board/templates";
import { normalizeSettings, SETTINGS_SCHEMAS } from "@/lib/widgets/settings";

import { db } from "../db";
import { boards, widgetPlacements, widgets } from "../db/schema";
import { toBoardWidget, widgetColumns, widgetWith } from "./widget-shape";

// 編集モードの、ウィジェットを置く・動かす・外す・設定を変える処理。
// どれも、ウィジェット → ボード → ユーザー とたどって、持ち主を確かめる（docs/er.md）

export type WidgetError =
  | { code: "not_found" }
  | { code: "out_of_grid" }
  | { code: "overlap" }
  | { code: "already_placed" }
  | { code: "invalid_settings"; message: string }
  // 中身の操作で、種類が合わないとき（ToDo でないウィジェットに項目を足す、など）
  | { code: "wrong_type"; message: string }
  // ToDo の項目が多すぎるとき
  | { code: "too_many"; message: string };

export type Result<T> =
  { ok: true; value: T } | { ok: false; error: WidgetError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (error: WidgetError): Result<never> => ({
  ok: false,
  error,
});

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ある表示先に置かれている配置（ボードの中のすべてのウィジェットぶん）
async function placementsOn(tx: Tx, boardId: string, target: DisplayTarget) {
  return tx
    .select({
      widgetId: widgetPlacements.widgetId,
      page: widgetPlacements.page,
      x: widgetPlacements.x,
      y: widgetPlacements.y,
      w: widgetPlacements.w,
      h: widgetPlacements.h,
    })
    .from(widgetPlacements)
    .innerJoin(widgets, eq(widgets.id, widgetPlacements.widgetId))
    .where(
      and(
        eq(widgets.boardId, boardId),
        eq(widgetPlacements.displayTarget, target),
      ),
    );
}

async function readWidget(widgetId: string): Promise<BoardWidget> {
  const widget = await db.query.widgets.findFirst({
    where: eq(widgets.id, widgetId),
    columns: widgetColumns,
    with: widgetWith,
  });
  if (!widget) {
    throw new Error("ウィジェットが見つかりません");
  }
  return toBoardWidget(widget);
}

// 自分のウィジェットなら、種類とボードを返す
export async function findOwnedWidget(userId: string, widgetId: string) {
  const [row] = await db
    .select({ id: widgets.id, type: widgets.type, boardId: widgets.boardId })
    .from(widgets)
    .innerJoin(boards, eq(boards.id, widgets.boardId))
    .where(and(eq(widgets.id, widgetId), eq(boards.userId, userId)));
  return row ?? null;
}

// 一覧からウィジェットを置く。その種類がもうボードにあれば、配置だけ作る
// （前の中身と設定のまま戻る。docs/api.md）
export async function placeWidget(
  userId: string,
  boardId: string,
  input: z.infer<typeof placeWidgetSchema>,
): Promise<Result<BoardWidget>> {
  const { type, displayTarget, ...placement } = input;

  const result = await db.transaction(async (tx): Promise<Result<string>> => {
    // 同じボードへの編集を1つずつ進めるため、ボードの行をロックする（重なりの確認がずれないように）
    const [board] = await tx
      .select({ id: boards.id })
      .from(boards)
      .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
      .for("update");
    if (!board) {
      return fail({ code: "not_found" });
    }
    if (!fitsGrid(placement, GRIDS[displayTarget])) {
      return fail({ code: "out_of_grid" });
    }

    const existing = await tx.query.widgets.findFirst({
      where: and(eq(widgets.boardId, boardId), eq(widgets.type, type)),
      columns: { id: true },
      with: { placements: { columns: { displayTarget: true } } },
    });
    if (existing?.placements.some((p) => p.displayTarget === displayTarget)) {
      return fail({ code: "already_placed" });
    }
    const others = await placementsOn(tx, boardId, displayTarget);
    if (others.some((other) => overlaps(placement, other))) {
      return fail({ code: "overlap" });
    }

    let widgetId = existing?.id;
    if (!widgetId) {
      const [created] = await tx
        .insert(widgets)
        .values({ boardId, type, settings: normalizeSettings(type, {}) })
        .returning({ id: widgets.id });
      if (!created) {
        throw new Error("ウィジェットを作れませんでした");
      }
      widgetId = created.id;
    }
    await tx
      .insert(widgetPlacements)
      .values({ widgetId, displayTarget, ...placement });
    return ok(widgetId);
  });

  return result.ok ? ok(await readWidget(result.value)) : result;
}

// 移動とサイズの変更。その表示先にまだ置いていなければ、新しく置く
export async function setPlacement(
  userId: string,
  widgetId: string,
  displayTarget: DisplayTarget,
  placement: Placement,
): Promise<Result<z.infer<typeof placementSchema>>> {
  return db.transaction(async (tx) => {
    // 持ち主を確かめながら、ボードの行をロックする
    const [owned] = await tx
      .select({ boardId: boards.id })
      .from(widgets)
      .innerJoin(boards, eq(boards.id, widgets.boardId))
      .where(and(eq(widgets.id, widgetId), eq(boards.userId, userId)))
      .for("update", { of: boards });
    if (!owned) {
      return fail({ code: "not_found" });
    }
    if (!fitsGrid(placement, GRIDS[displayTarget])) {
      return fail({ code: "out_of_grid" });
    }
    const others = (
      await placementsOn(tx, owned.boardId, displayTarget)
    ).filter((other) => other.widgetId !== widgetId);
    if (others.some((other) => overlaps(placement, other))) {
      return fail({ code: "overlap" });
    }

    const [saved] = await tx
      .insert(widgetPlacements)
      .values({ widgetId, displayTarget, ...placement })
      .onConflictDoUpdate({
        target: [widgetPlacements.widgetId, widgetPlacements.displayTarget],
        set: placement,
      })
      .returning({
        displayTarget: widgetPlacements.displayTarget,
        page: widgetPlacements.page,
        x: widgetPlacements.x,
        y: widgetPlacements.y,
        w: widgetPlacements.w,
        h: widgetPlacements.h,
      });
    return ok(placementSchema.parse(saved));
  });
}

// 「外す」。その表示先の配置だけ消し、ウィジェットと中身は残す
export async function removePlacement(
  userId: string,
  widgetId: string,
  displayTarget: DisplayTarget,
): Promise<Result<null>> {
  if (!(await findOwnedWidget(userId, widgetId))) {
    return fail({ code: "not_found" });
  }
  await db
    .delete(widgetPlacements)
    .where(
      and(
        eq(widgetPlacements.widgetId, widgetId),
        eq(widgetPlacements.displayTarget, displayTarget),
      ),
    );
  return ok(null);
}

// 設定を変える。種類ごとのスキーマで確かめ、足りない項目は初期値で埋めて保存する
export async function updateSettings(
  userId: string,
  widgetId: string,
  settings: Record<string, unknown>,
): Promise<Result<BoardWidget>> {
  const widget = await findOwnedWidget(userId, widgetId);
  if (!widget) {
    return fail({ code: "not_found" });
  }
  const schema = SETTINGS_SCHEMAS[widget.type];
  if (!schema) {
    return fail({
      code: "invalid_settings",
      message: "このウィジェットの設定は、まだ変えられません",
    });
  }
  const parsed = schema.safeParse(settings);
  if (!parsed.success) {
    return fail({
      code: "invalid_settings",
      message: parsed.error.issues[0]?.message ?? "設定が正しくありません",
    });
  }
  await db
    .update(widgets)
    .set({ settings: parsed.data as Record<string, unknown> })
    .where(eq(widgets.id, widgetId));
  return ok(await readWidget(widgetId));
}
