import * as z from "zod";

import { refreshMinutesSchema } from "./refresh";

// ニュース・RSS の設定（widgets.settings）、フィードと記事の形、表示する記事の選び方

export const NEWS_FEEDS_MAX = 10;
export const NEWS_TITLE_MAX = 100;
// 1つのフィードから返す記事の数（1列に出すのは多くても10件）
export const NEWS_ITEMS_PER_FEED = 10;
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
  // ウィジェットに出すか（false なら、登録したまま隠す）
  visible: z.boolean(),
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

// 記事を読むフィード（ID をカンマでつなぐ）。画面が今表示にしているフィードを渡す。
// 表示・非表示の保存が終わる前に読み直しても、画面と同じフィードを読むため
export const newsItemsQuerySchema = z.object({
  feeds: z
    .string()
    .transform((value) => value.split(","))
    .pipe(
      z
        .array(z.uuid("フィードの ID が正しくありません"))
        .min(1, "フィードを選んでください")
        .max(NEWS_FEEDS_MAX, `フィードは${NEWS_FEEDS_MAX}個までです`),
    )
    .optional(),
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
    visible: z
      .boolean({ error: "表示するかどうかが正しくありません" })
      .optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.sortOrder !== undefined ||
      value.visible !== undefined,
    { error: "変える値がありません" },
  );

// よく使われるフィード（設定パネルの「＋」のボタン）
export const NEWS_PRESETS = [
  {
    label: "はてブ テクノロジー",
    url: "https://b.hatena.ne.jp/hotentry/it.rss",
  },
  { label: "Qiita 人気の記事", url: "https://qiita.com/popular-items/feed" },
  { label: "Zenn トレンド", url: "https://zenn.dev/feed" },
  {
    label: "企業テックブログRSS",
    url: "https://yamadashy.github.io/tech-blog-rss-feed/feeds/rss.xml",
  },
] as const;

// ボタンにはしないが、RSS の URL の探し方を案内するサイト（利用者が自分で URL を貼る）
export const NEWS_RSS_GUIDES = [
  { label: "NHK", url: "https://www.nhk.or.jp/toppage/rss/index.html" },
  { label: "Yahoo!ニュース", url: "https://news.yahoo.co.jp/rss" },
] as const;

// 列に並べるフィード。表示するフィードを並び順に、横のマスの数だけ（1マスに1列）
export function newsColumns<T extends Pick<NewsFeed, "sortOrder" | "visible">>(
  feeds: T[],
  width: number,
): T[] {
  return feeds
    .filter((feed) => feed.visible)
    .toSorted((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, Math.max(1, width));
}

// 今あるフィードの記事だけを残す。フィードを消した直後の読み直しは、消す前の記事を返すことがある
// （削除の保存より先にサーバーに届いたとき）ので、ボードのフィードで絞る
export function itemsOfFeeds(
  items: NewsItem[],
  feeds: Pick<NewsFeed, "id">[],
): NewsItem[] {
  const ids = new Set(feeds.map((feed) => feed.id));
  return items.filter((item) => ids.has(item.feedId));
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
