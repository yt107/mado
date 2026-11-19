import * as z from "zod";

// メモの設定（widgets.settings）と、本文の決まり

export const MEMO_BODY_MAX = 500;

export const MEMO_COLORS = ["yellow", "pink", "blue", "green", "dark"] as const;

export const memoSettingsSchema = z.object({
  fontSize: z.enum(["small", "medium", "large"]).default("medium"),
  color: z.enum(MEMO_COLORS).default("yellow"),
});

export type MemoSettings = z.infer<typeof memoSettingsSchema>;

export function readMemoSettings(settings: unknown): MemoSettings {
  const result = memoSettingsSchema.safeParse(settings);
  return result.success ? result.data : memoSettingsSchema.parse({});
}

export const memoBodySchema = z
  .string({ error: "本文の形が正しくありません" })
  .max(MEMO_BODY_MAX, `本文は${MEMO_BODY_MAX}文字までにしてください`);

// 「たった今」「5分前」「2時間前」「3日前」
export function relativeTimeLabel(from: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}
