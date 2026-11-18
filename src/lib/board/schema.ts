import * as z from "zod";

import { WIDGET_TYPES } from "../widgets/types";
import { DISPLAY_TARGETS } from "./display-targets";
import { TEMPLATE_IDS } from "./templates";

// ボードの API が受け取る値と返す値の形（docs/api.md）。
// 画面とサーバーの両方で使う

export const createBoardSchema = z.object({
  templateId: z.enum(TEMPLATE_IDS, { error: "テンプレートを選んでください" }),
});

export const placementSchema = z.object({
  displayTarget: z.enum(DISPLAY_TARGETS),
  page: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
});

export const widgetSchema = z.object({
  id: z.string(),
  type: z.enum(WIDGET_TYPES),
  // 中身は種類ごとに違う。使うところで、種類ごとのスキーマで読む
  settings: z.record(z.string(), z.unknown()),
  placements: z.array(placementSchema),
});

export const boardDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  widgets: z.array(widgetSchema),
});

export const boardSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
});

export type BoardDetail = z.infer<typeof boardDetailSchema>;
export type BoardWidget = z.infer<typeof widgetSchema>;
export type BoardSummary = z.infer<typeof boardSummarySchema>;
