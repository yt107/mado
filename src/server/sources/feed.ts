import { extractFromXml } from "@extractus/feed-extractor";

// RSS・Atom・RSS 1.0（RDF）を読み、記事の一覧にそろえる。
// サイトの URL が入力されたときは、HTML の <link rel="alternate"> からフィードを探す

export class FeedParseError extends Error {
  constructor() {
    super("RSS・Atom の形式ではありません");
    this.name = "FeedParseError";
  }
}

export type FeedEntry = {
  title: string;
  link: string;
  // 日時は ISO 8601（UTC）。フィードに書かれていなければ null
  publishedAt: string | null;
  image: string | null;
  summary: string;
};

export type ParsedFeed = {
  title: string | null;
  entries: FeedEntry[];
};

// 1つのフィードから使う記事の数
const MAX_ENTRIES = 20;

// 本文がフィード（RSS・Atom・RDF）らしいか。HTML ならサイトのページとして扱う
export function looksLikeFeed(text: string): boolean {
  const head = text.slice(0, 2000).replace(/<!--[\s\S]*?-->/g, "");
  return /<(rss|feed|rdf:RDF)[\s>]/i.test(head) && !/<html[\s>]/i.test(head);
}

function httpsUrl(value: unknown, base?: string): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value.trim(), base);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function webUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function asList(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function attr(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[`@_${name}`]
    : undefined;
}

// 記事の画像。enclosure、media:thumbnail、media:content、はてなの画像の順に探す（https だけ）
function entryImage(entry: Record<string, unknown>): string | null {
  for (const enclosure of asList(entry.enclosure)) {
    const type = attr(enclosure, "type");
    // 種類が image/… のもの。種類が書かれていない（Zenn は "false"）ものも画像とみなす。
    // 音声や動画（ポッドキャスト）は audio/… や video/… と書かれるので、使わない
    if (
      typeof type !== "string" ||
      !type.includes("/") ||
      type.startsWith("image/")
    ) {
      const url = httpsUrl(attr(enclosure, "url"));
      if (url) return url;
    }
  }
  const media = [
    ...asList(entry["media:thumbnail"]),
    ...asList(entry["media:content"]),
    ...asList(
      (entry["media:group"] as Record<string, unknown> | undefined)?.[
        "media:thumbnail"
      ],
    ),
  ];
  for (const item of media) {
    const medium = attr(item, "medium");
    const type = attr(item, "type");
    const isImage =
      medium === "image" ||
      (typeof type === "string" && type.startsWith("image/")) ||
      (medium === undefined && type === undefined);
    const url = isImage ? httpsUrl(attr(item, "url")) : null;
    if (url) return url;
  }
  return httpsUrl(entry["hatena:imageurl"]);
}

export function parseFeed(xml: string, baseUrl: string): ParsedFeed {
  if (!looksLikeFeed(xml)) {
    throw new FeedParseError();
  }
  let feed: ReturnType<typeof extractFromXml>;
  try {
    feed = extractFromXml(xml, {
      baseUrl,
      descriptionMaxLen: 160,
      getExtraEntryFields: (entry) => ({
        image: entryImage(entry as Record<string, unknown>),
      }),
    });
  } catch {
    throw new FeedParseError();
  }

  const entries: FeedEntry[] = [];
  for (const entry of feed.entries ?? []) {
    const raw = entry as typeof entry & { image?: string | null };
    const title = raw.title?.trim();
    const link = webUrl(raw.link);
    if (!title || !link) continue;
    const published = raw.published ? new Date(raw.published) : null;
    entries.push({
      title,
      link,
      publishedAt:
        published && !Number.isNaN(published.getTime())
          ? published.toISOString()
          : null,
      image: raw.image ?? null,
      summary: raw.description?.trim() ?? "",
    });
    if (entries.length >= MAX_ENTRIES) break;
  }
  return { title: feed.title?.trim() || null, entries };
}

// HTML の <link rel="alternate" type="application/rss+xml" href="…"> から、フィードの URL を探す
export function findFeedLink(html: string, baseUrl: string): string | null {
  const head = html.slice(0, 200_000);
  for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const match of tag.matchAll(
      /([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
    )) {
      const name = match[1]?.toLowerCase();
      if (name) attrs[name] = match[2] ?? match[3] ?? match[4] ?? "";
    }
    const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/);
    const type = (attrs.type ?? "").toLowerCase();
    if (
      rel.includes("alternate") &&
      (type === "application/rss+xml" || type === "application/atom+xml")
    ) {
      const url = httpsUrl(attrs.href?.replace(/&amp;/g, "&"), baseUrl);
      if (url) return url;
    }
  }
  return null;
}
