import * as z from "zod";

import { refreshMinutesSchema } from "./refresh";

// ニュース・RSS の設定（widgets.settings）、フィードと記事の形、表示する記事の選び方

export const NEWS_FEEDS_MAX = 10;
export const NEWS_TITLE_MAX = 100;
// 1×1 で見出しを切り替える間隔（画面設計：10秒ごと）
export const NEWS_ROTATE_MS = 10_000;

export const NEWS_COUNTS = ["auto", "3", "5", "10"] as const;

export const newsSettingsSchema = z.object({
  // 表示する件数。auto は大きさに合わせる
  count: z.enum(NEWS_COUNTS).default("auto"),
  // 画像を出す（2×2 以上）
  showImages: z.boolean().default(true),
  // 見出しを自動で送る（1×1）
  autoRotate: z.boolean().default(true),
  // 同じ記事（同じリンクか、同じ見出し）を1つにまとめる
  dedupe: z.boolean().default(true),
  refreshMinutes: refreshMinutesSchema(15),
});

export type NewsSettings = z.infer<typeof newsSettingsSchema>;

export function readNewsSettings(settings: unknown): NewsSettings {
  const result = newsSettingsSchema.safeParse(settings);
  return result.success ? result.data : newsSettingsSchema.parse({});
}

export const newsFeedSchema = z.object({
  id: z.string(),
  title: z.string(),
  feedUrl: z.string(),
  sortOrder: z.number().int(),
  lastFetchedAt: z.string().nullable(),
  lastError: z.string().nullable(),
});

export type NewsFeed = z.infer<typeof newsFeedSchema>;

export const newsItemSchema = z.object({
  id: z.string(),
  feedId: z.string(),
  title: z.string(),
  link: z.string(),
  // 日時は ISO 8601（UTC）。フィードに書かれていなければ null
  publishedAt: z.string().nullable(),
  image: z.string().nullable(),
  summary: z.string(),
});

export type NewsItem = z.infer<typeof newsItemSchema>;

export const newsItemsResponseSchema = z.object({
  feeds: z.array(newsFeedSchema),
  items: z.array(newsItemSchema),
});

export type NewsItemsResponse = z.infer<typeof newsItemsResponseSchema>;

export const createNewsFeedSchema = z.object({
  url: z
    .string({ error: "URL を入力してください" })
    .trim()
    .min(1, "URL を入力してください")
    .max(2048, "URL が長すぎます"),
});

export const newsTitleSchema = z
  .string({ error: "名前を入力してください" })
  .trim()
  .min(1, "名前を入力してください")
  .max(NEWS_TITLE_MAX, `名前は${NEWS_TITLE_MAX}文字までにしてください`);

export const updateNewsFeedSchema = z
  .object({
    title: newsTitleSchema.optional(),
    // 並べ替え：このフィードを何番目（0から数える）に動かすか
    sortOrder: z
      .number({ error: "並び順が正しくありません" })
      .int("並び順が正しくありません")
      .min(0, "並び順が正しくありません")
      .optional(),
  })
  .refine(
    (value) => value.title !== undefined || value.sortOrder !== undefined,
    { error: "変える値がありません" },
  );

// よく使われるフィード（画面設計の「＋ はてブ人気」「＋ Qiita トレンド」）
export const NEWS_PRESETS = [
  { label: "はてブ人気", url: "https://b.hatena.ne.jp/hotentry/all.rss" },
  { label: "Qiita トレンド", url: "https://qiita.com/popular-items/feed" },
] as const;

// フィードの色（並び順で決める。ニュースの見出しの前の印）
export const FEED_COLORS = [
  "#e5534b",
  "#5b8def",
  "#2bb3a8",
  "#3fb76f",
  "#a371f7",
  "#ee9a3a",
  "#e86fa8",
  "#d4b22c",
] as const;

export function feedColor(sortOrder: number): string {
  return FEED_COLORS[sortOrder % FEED_COLORS.length] ?? FEED_COLORS[0];
}

function normalizedTitle(title: string) {
  return title.replace(/\s+/g, "").toLowerCase();
}

// 同じ記事を1つにまとめる（先に出てきた、新しいほうを残す）
export function dedupeItems(items: NewsItem[]): NewsItem[] {
  const seenLinks = new Set<string>();
  const seenTitles = new Set<string>();
  return items.filter((item) => {
    const link = item.link.replace(/[?#].*$/, "");
    const title = normalizedTitle(item.title);
    if (seenLinks.has(link) || seenTitles.has(title)) return false;
    seenLinks.add(link);
    seenTitles.add(title);
    return true;
  });
}

// 表示する件数。「大きさに合わせる」は、画面設計のサイズ別の表示に合わせる
export function newsCount(
  count: NewsSettings["count"],
  w: number,
  h: number,
): number {
  if (count !== "auto") return Number(count);
  // 1×1 は1件ずつ切り替える（5件を順に）。横長の1行は3件、2行は5件、それより高ければ10件
  if (w === 1 && h === 1) return 5;
  if (h === 1) return 3;
  if (h === 2) return 5;
  return 10;
}

// 「12分前」「3時間前」「11月6日」
export function publishedLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
