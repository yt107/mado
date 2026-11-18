import "server-only";

import { cache } from "react";

import { getBoardDetail, listBoards } from "@/server/services/boards";

// 画面（Server Components）から、自分のボードを読む。
// API を通さずに、API と同じ処理（services）を直接呼ぶ（Next.js の案内どおり）

export const hasBoard = cache(async (userId: string) => {
  const boards = await listBoards(userId);
  return boards.length > 0;
});

// MVP では1人1ボードなので、最初のボードを返す。まだなければ null
export const getMyBoard = cache(async (userId: string) => {
  const [first] = await listBoards(userId);
  return first ? getBoardDetail(userId, first.id) : null;
});
