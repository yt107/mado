"use client";

import {
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
  feedColor,
  NEWS_FEEDS_MAX,
  NEWS_PRESETS,
  NEWS_TITLE_MAX,
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
  onSettingsChange: (settings: NewsSettings) => void;
  // 登録できなかったときは、その理由を返す
  onAdd: (url: string) => Promise<string | null>;
  onRename: (feedId: string, title: string) => void;
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
  onSettingsChange,
  onAdd,
  onRename,
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
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: feedColor(index) }}
                />
                <div className="min-w-0 flex-1 pl-1">
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
                    {feed.lastError ? (
                      <FetchStatusText
                        lastFetchedAt={feed.lastFetchedAt}
                        lastError={feed.lastError}
                      />
                    ) : (
                      hostOf(feed.feedUrl)
                    )}
                  </p>
                </div>
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
        <Switch
          label="同じ記事をまとめる"
          checked={s.dedupe}
          onChange={(dedupe) => onSettingsChange({ ...s, dedupe })}
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
        表示モードでは、見出しを押しても記事は開きません。
      </p>
    </PanelShell>
  );
}
