import { and, asc, count, countDistinct, eq } from "drizzle-orm";

import type { DisplayTarget } from "@/lib/board/display-targets";
import {
  boardDetailSchema,
  boardSummarySchema,
  type BoardDetail,
  type BoardSummary,
} from "@/lib/board/schema";
import { TEMPLATES, type TemplateId } from "@/lib/board/templates";
import { normalizeSettings } from "@/lib/widgets/settings";
import type { WeatherLocation } from "@/lib/widgets/weather";

import { db } from "../db";
import { boards, users, widgetPlacements, widgets } from "../db/schema";
import { toBoardWidget, widgetColumns, widgetWith } from "./widget-shape";

// ボードを読み書きする処理。API（Hono）と画面（Server Components）の両方から使う。
// どれも userId で持ち主を確かめる。他人のボードは「ない」として扱う（docs/api.md）

export const DEFAULT_BOARD_NAME = "マイボード";

export async function listBoards(userId: string): Promise<BoardSummary[]> {
  const rows = await db
    .select({ id: boards.id, name: boards.name, sortOrder: boards.sortOrder })
    .from(boards)
    .where(eq(boards.userId, userId))
    .orderBy(asc(boards.sortOrder), asc(boards.createdAt));
  return rows.map((row) => boardSummarySchema.parse(row));
}

// ボードの中身を全部返す。ない、または他人のボードなら null
export async function getBoardDetail(
  userId: string,
  boardId: string,
): Promise<BoardDetail | null> {
  const board = await db.query.boards.findFirst({
    where: and(eq(boards.id, boardId), eq(boards.userId, userId)),
    columns: { id: true, name: true },
    with: {
      widgets: {
        columns: widgetColumns,
        // 種類の順（時計、天気、カレンダー…）にそろえる
        orderBy: [asc(widgets.type)],
        // 配置、ToDo の項目、メモの本文も一緒に読む
        with: widgetWith,
      },
    },
  });
  if (!board) {
    return null;
  }
  return boardDetailSchema.parse({
    ...board,
    widgets: board.widgets.map(toBoardWidget),
  });
}

// テンプレートからボードを作る。もうボードがあれば作らずに null を返す（MVP では1人1つ）。
// 地域を選んでいたら、天気のウィジェットの設定に入れる（docs/er.md）
export async function createBoardFromTemplate(
  userId: string,
  templateId: TemplateId,
  location?: WeatherLocation,
): Promise<BoardDetail | null> {
  const template = TEMPLATES[templateId];

  const boardId = await db.transaction(async (tx) => {
    // 同時に2回送られても、ボードが2つできないようにする。
    // ユーザーの行をロックしてから確かめるので、2回目は1回目が終わるまで待ち、ボードがあると分かる
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    const existing = await tx
      .select({ id: boards.id })
      .from(boards)
      .where(eq(boards.userId, userId))
      .limit(1);
    if (existing.length > 0) {
      return null;
    }

    const [board] = await tx
      .insert(boards)
      .values({ userId, name: DEFAULT_BOARD_NAME })
      .returning({ id: boards.id });
    if (!board) {
      throw new Error("ボードを作れませんでした");
    }
    if (template.widgets.length === 0) {
      return board.id;
    }

    const created = await tx
      .insert(widgets)
      .values(
        template.widgets.map((widget) => ({
          boardId: board.id,
          type: widget.type,
          settings: normalizeSettings(widget.type, {
            ...widget.settings,
            ...(widget.type === "weather" && location && { location }),
          }),
        })),
      )
      .returning({ id: widgets.id, type: widgets.type });
    // 種類はボードの中で1つずつなので、種類から ID を引ける
    const idByType = new Map(created.map((row) => [row.type, row.id]));

    const placementRows = template.widgets.flatMap((widget) => {
      const widgetId = idByType.get(widget.type);
      if (!widgetId) {
        throw new Error("ウィジェットを作れませんでした");
      }
      return Object.entries(widget.placements).map(([target, placement]) => ({
        widgetId,
        displayTarget: target as DisplayTarget,
        ...placement,
      }));
    });
    if (placementRows.length > 0) {
      await tx.insert(widgetPlacements).values(placementRows);
    }
    return board.id;
  });

  if (!boardId) {
    return null;
  }
  return getBoardDetail(userId, boardId);
}

// 退会の確認で見せる、消えるデータの数（ボードの数と、ウィジェットの数）
export async function countMyData(userId: string) {
  const [row] = await db
    .select({
      boards: countDistinct(boards.id),
      widgets: count(widgets.id),
    })
    .from(boards)
    .leftJoin(widgets, eq(widgets.boardId, boards.id))
    .where(eq(boards.userId, userId));
  return { boards: row?.boards ?? 0, widgets: row?.widgets ?? 0 };
}
