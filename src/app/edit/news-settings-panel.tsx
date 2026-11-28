"use client";

import {
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  LoaderCircle,
  Newspaper,
  Plus,
  Rss,
  X,
} from "lucide-react";
import { useId, useState } from "react";

import { cx } from "@/lib/cx";
import {
  NEWS_FEEDS_MAX,
  NEWS_PRESETS,
  NEWS_RSS_GUIDES,
  NEWS_TITLE_MAX,
  newsColumns,
  readNewsSettings,
  type NewsFeed,
  type NewsSettings,
} from "@/lib/widgets/news";

import {
  FetchStatusText,
  isComposing,
  PanelShell,
  RefreshSelect,
  Segmented,
  Switch,
} from "./panel-parts";
import { useDragSort } from "./use-drag-sort";

type Props = {
  settings: Record<string, unknown>;
  feeds: NewsFeed[];
  sizeLabel: string;
  // 今の表示先での横のマスの数（置いていなければ null）
  width: number | null;
  onSettingsChange: (settings: NewsSettings) => void;
  // 登録できなかったときは、その理由を返す
  onAdd: (url: string) => Promise<string | null>;
  onRename: (feedId: string, title: string) => void;
  onToggle: (feedId: string, visible: boolean) => void;
  onMove: (feedId: string, toIndex: number) => void;
  onDelete: (feedId: string) => void;
  onAnnounce: (message: string) => void;
  onClose: () => void;
};

function hostOf(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    return `${hostname}${pathname === "/" ? "" : pathname}`;
  } catch {
    return url;
  }
}

// ニュース・RSS の設定（画面設計「ウィジェット設定（ニュース・RSS）」）
export function NewsSettingsPanel({
  settings,
  feeds,
  sizeLabel,
  width,
  onSettingsChange,
  onAdd,
  onRename,
  onToggle,
  onMove,
  onDelete,
  onAnnounce,
  onClose,
}: Props) {
  const s = readNewsSettings(settings);
  const id = useId();
  const sorted = feeds.toSorted((a, b) => a.sortOrder - b.sortOrder);
  const { listRef, ordered, draggingId, handleProps } = useDragSort(
    sorted,
    (feed, toIndex) => {
      onMove(feed.id, toIndex);
      onAnnounce(`「${feed.title}」を${toIndex + 1}番目に動かしました`);
    },
  );

  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const full = feeds.length >= NEWS_FEEDS_MAX;

  async function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || adding) return;
    setAdding(trimmed);
    setError(null);
    const message = await onAdd(trimmed);
    setAdding(null);
    if (message) {
      setError(message);
    } else if (trimmed === url.trim()) {
      setUrl("");
    }
  }

  const presets = NEWS_PRESETS.filter(
    (preset) => !feeds.some((feed) => feed.feedUrl === preset.url),
  );
  // 今の大きさで列に出るフィード（置いていなければ、表示するものは全部出る扱い）
  const shownIds = new Set(
    newsColumns(feeds, width ?? NEWS_FEEDS_MAX).map((feed) => feed.id),
  );

  return (
    <PanelShell
      icon={Newspaper}
      iconColor="#7c5cff"
      title="ニュース・RSSの設定"
      subtitle={`${sizeLabel}・変更はすぐボードに反映`}
      onClose={onClose}
    >
      <section aria-labelledby={`${id}-feeds`}>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 id={`${id}-feeds`} className="text-xs font-bold text-ink-2">
            フィード
          </h3>
          {feeds.length > 1 && (
            <span className="text-[0.6875rem] text-ink-3">
              ドラッグで並べ替え
            </span>
          )}
        </div>
        <p className="mb-2 text-xs leading-relaxed text-ink-3">
          表示するフィードを上から順に、横1マスにつき1つずつ並べます
          {width !== null && `（今の大きさでは${width}つまで）`}
        </p>
        {feeds.length === 0 ? (
          <p className="text-xs text-ink-3">まだありません</p>
        ) : (
          <ul ref={listRef} className="flex flex-col gap-1.5">
            {ordered.map((feed, index) => (
              <li
                key={feed.id}
                data-item={feed.id}
                className={cx(
                  "flex items-center gap-1 rounded-lg border bg-card py-1.5 pr-1 pl-1",
                  feed.lastError ? "border-danger/60" : "border-line",
                  draggingId === feed.id && "opacity-60 ring-2 ring-accent",
                )}
              >
                <button
                  type="button"
                  aria-label={`「${feed.title}」を並べ替える（${index + 1}番目。↑↓キーで動かす）`}
                  className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-3 select-none hover:text-ink"
                  {...handleProps(feed)}
                >
                  <GripVertical aria-hidden className="size-4" />
                </button>
                <div
                  className={cx(
                    "min-w-0 flex-1",
                    !feed.visible && "text-ink-3",
                  )}
                >
                  <input
                    type="text"
                    defaultValue={feed.title}
                    maxLength={NEWS_TITLE_MAX}
                    aria-label="フィードの名前"
                    onBlur={(event) => {
                      const title = event.target.value.trim();
                      if (title && title !== feed.title) {
                        onRename(feed.id, title);
                      } else {
                        event.target.value = feed.title;
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !isComposing(event)) {
                        event.currentTarget.blur();
                      }
                    }}
                    className="w-full rounded-md bg-transparent px-1 py-0.5 font-medium"
                  />
                  <p className="truncate px-1 text-[0.6875rem] text-ink-3">
                    {!feed.visible ? (
                      "非表示"
                    ) : feed.lastError ? (
                      <FetchStatusText
                        lastFetchedAt={feed.lastFetchedAt}
                        lastError={feed.lastError}
                      />
                    ) : shownIds.has(feed.id) ? (
                      hostOf(feed.feedUrl)
                    ) : (
                      "今の大きさでは出ません（横のマスが足りません）"
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={feed.visible}
                  aria-label={`「${feed.title}」を表示する`}
                  title={feed.visible ? "表示中" : "非表示"}
                  onClick={() => {
                    onToggle(feed.id, !feed.visible);
                    onAnnounce(
                      feed.visible
                        ? `「${feed.title}」を非表示にしました`
                        : `「${feed.title}」を表示にしました`,
                    );
                  }}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-raised hover:text-ink"
                >
                  {feed.visible ? (
                    <Eye aria-hidden className="size-3.5" />
                  ) : (
                    <EyeOff aria-hidden className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(feed.id);
                    onAnnounce(`「${feed.title}」の登録をやめました`);
                  }}
                  aria-label={`「${feed.title}」の登録をやめる`}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-raised hover:text-ink"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${id}-add`}>
        <h3 id={`${id}-add`} className="mb-2 text-xs font-bold text-ink-2">
          フィードを追加
        </h3>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Rss
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            />
            <input
              type="url"
              inputMode="url"
              value={url}
              disabled={full || adding !== null}
              aria-label="RSS / Atom またはサイトの URL"
              aria-describedby={`${id}-help ${id}-error`}
              placeholder={
                full
                  ? `${NEWS_FEEDS_MAX}個まで登録できます`
                  : "RSS / Atom またはサイトの URL"
              }
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isComposing(event)) {
                  event.preventDefault();
                  void add(url);
                }
              }}
              className="h-10 w-full rounded-[10px] border border-line bg-card pr-3 pl-9 placeholder:text-ink-3"
            />
          </div>
          <button
            type="button"
            onClick={() => void add(url)}
            disabled={full || adding !== null || url.trim() === ""}
            className="flex h-10 shrink-0 items-center gap-1 rounded-[10px] border border-line bg-card px-3 font-bold hover:bg-raised disabled:opacity-50"
          >
            {adding !== null && adding === url.trim() ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            ) : (
              <Plus aria-hidden className="size-4" />
            )}
            追加
          </button>
        </div>
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs text-danger"
        >
          {error}
        </p>
        <p id={`${id}-help`} className="mt-1 text-xs text-ink-3">
          サイトの URL を入力すると、フィードを自動で探します
        </p>
        {presets.length > 0 && !full && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.url}
                type="button"
                disabled={adding !== null}
                onClick={() => void add(preset.url)}
                className="flex items-center gap-1 rounded-lg border border-line bg-card px-2 py-1 text-xs text-ink-2 hover:text-ink disabled:opacity-50"
              >
                {adding === preset.url ? (
                  <LoaderCircle aria-hidden className="size-3 animate-spin" />
                ) : (
                  <Plus aria-hidden className="size-3" />
                )}
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          ほかのニュースは、サイトの RSS のページで URL
          をコピーして、上に貼ってください（利用条件は各サイトで確かめてください）：
          {NEWS_RSS_GUIDES.map((guide) => (
            <a
              key={guide.url}
              href={guide.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              {guide.label}
              <ExternalLink aria-hidden className="size-3" />
              <span className="sr-only">（新しいタブで開く）</span>
            </a>
          ))}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <Segmented
          legend="表示する件数"
          value={s.count}
          options={[
            ["auto", "サイズに合わせる"],
            ["3", "3件"],
            ["5", "5件"],
            ["10", "10件"],
          ]}
          onChange={(count) => onSettingsChange({ ...s, count })}
        />
        <Switch
          label="画像を表示（2×2以上）"
          checked={s.showImages}
          onChange={(showImages) => onSettingsChange({ ...s, showImages })}
        />
        <Switch
          label="見出しを自動で送る（1×1）"
          checked={s.autoRotate}
          onChange={(autoRotate) => onSettingsChange({ ...s, autoRotate })}
        />
      </section>

      <RefreshSelect
        value={s.refreshMinutes}
        onChange={(refreshMinutes) =>
          onSettingsChange({ ...s, refreshMinutes })
        }
      />

      <p className="flex gap-1.5 text-xs leading-relaxed text-ink-3">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        表示モードでは、見出しを押すと元の記事を新しいタブで開きます。
      </p>
    </PanelShell>
  );
}
