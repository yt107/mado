"use client";

import {
  Grid2x2,
  Keyboard,
  Monitor,
  MousePointerClick,
  Move,
  PanelLeftOpen,
  Scaling,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import { WIDGET_ICONS } from "@/components/widgets/widget-icon";
import { api } from "@/lib/api-client";
import {
  DESIGN_SIZES,
  DISPLAY_TARGET_LABELS,
  DISPLAY_TARGETS,
  GRIDS,
  pickDisplayTarget,
  type DisplayTarget,
} from "@/lib/board/display-targets";
import {
  describePlacement,
  dropPlacement,
  othersOn,
  placementOn,
} from "@/lib/board/edit";
import { clampSize, findFreeSpot } from "@/lib/board/layout";
import type { BoardDetail, BoardWidget } from "@/lib/board/schema";
import type { Placement } from "@/lib/board/templates";
import type {
  CalendarColor,
  CalendarSubscription,
} from "@/lib/widgets/calendar";
import type { NewsFeed } from "@/lib/widgets/news";
import { SETTINGS_SCHEMAS } from "@/lib/widgets/settings";
import type { TodoItem } from "@/lib/widgets/todo";
import {
  DEFAULT_SIZES,
  WIDGET_LABELS,
  type WidgetType,
} from "@/lib/widgets/types";
import { useSessionKeepAlive } from "@/lib/hooks/use-session-keep-alive";

import { CalendarSettingsPanel } from "./calendar-settings-panel";
import { ClockSettingsPanel } from "./clock-settings-panel";
import { CountdownSettingsPanel } from "./countdown-settings-panel";
import { MemoSettingsPanel } from "./memo-settings-panel";
import { NewsSettingsPanel } from "./news-settings-panel";
import { TodoSettingsPanel } from "./todo-settings-panel";
import { WeatherSettingsPanel } from "./weather-settings-panel";
import { EditBoard, type BoardHandle, type DropPreview } from "./edit-board";
import { EditorHeader } from "./editor-header";
import { useDebouncedSaves } from "./use-debounced-saves";
import { useSaveQueue } from "./use-save-queue";
import { WidgetPalette, type PaletteStatus } from "./widget-palette";

type Props = {
  board: BoardDetail;
  user: { name: string; email: string };
};

type PaletteDrag = {
  type: WidgetType;
  x: number;
  y: number;
  preview: DropPreview | null;
};

// API のエラーの本文から、見せる文を取り出す（docs/api.md のエラーの形）
async function errorMessageOf(res: Response, fallback: string) {
  try {
    const body: unknown = await res.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error !== null &&
      "message" in body.error &&
      typeof body.error.message === "string"
    ) {
      return body.error.message;
    }
  } catch {
    // 本文が JSON でなければ、決まった文を出す
  }
  return fallback;
}

function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

// 編集モード。操作するたびに、画面をすぐ変えてから保存する（失敗したらサーバーの状態に戻す）
export function Editor({ board, user }: Props) {
  const router = useRouter();
  // 開いているあいだは、ログインの期限を延ばす（表示用の端末がログアウトしないように）
  useSessionKeepAlive();
  const [widgets, setWidgets] = useState<BoardWidget[]>(board.widgets);

  // 最初は、今の画面の大きさに合う表示先で開く（docs/er.md）。選び直したら、それを使う
  const autoTarget = useSyncExternalStore(
    subscribeResize,
    () => pickDisplayTarget(window.innerWidth, window.innerHeight),
    () => "pc" as const,
  );
  const [chosenTarget, setChosenTarget] = useState<DisplayTarget | null>(null);
  const target = chosenTarget ?? autoTarget;
  const grid = GRIDS[target];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null);
  const paletteDragRef = useRef<PaletteDrag | null>(null);
  const boardRef = useRef<BoardHandle>(null);

  const reload = useCallback(async () => {
    const res = await api.boards[":boardId"].$get({
      param: { boardId: board.id },
    });
    if (res.ok) {
      setWidgets((await res.json()).widgets);
    }
  }, [board.id]);
  const saver = useSaveQueue({
    onUnauthorized: useCallback(() => router.push("/login"), [router]),
    onFailed: reload,
  });

  function announce(message: string) {
    setAnnouncement(message);
  }

  // この表示先での配置を、画面の中だけで変える（保存の結果を待たずに、すぐ動かす）
  function setPlacementLocally(widgetId: string, placement: Placement | null) {
    setWidgets((current) =>
      current.map((widget) =>
        widget.id !== widgetId
          ? widget
          : {
              ...widget,
              placements: [
                ...widget.placements.filter((p) => p.displayTarget !== target),
                ...(placement ? [{ displayTarget: target, ...placement }] : []),
              ],
            },
      ),
    );
  }

  function labelOf(widgetId: string) {
    const widget = widgets.find((w) => w.id === widgetId);
    return widget ? WIDGET_LABELS[widget.type] : "ウィジェット";
  }

  function commitPlacement(widgetId: string, placement: Placement) {
    setPlacementLocally(widgetId, placement);
    const displayTarget = target;
    saver.run(() =>
      api.widgets[":widgetId"].placements[":displayTarget"].$put({
        param: { widgetId, displayTarget },
        json: placement,
      }),
    );
    announce(
      `${labelOf(widgetId)}を${describePlacement(placement, grid)}にしました`,
    );
  }

  function removeFromTarget(widgetId: string) {
    setPlacementLocally(widgetId, null);
    setSelectedId(null);
    setSettingsId(null);
    const displayTarget = target;
    saver.run(() =>
      api.widgets[":widgetId"].placements[":displayTarget"].$delete({
        param: { widgetId, displayTarget },
      }),
    );
    announce(`${labelOf(widgetId)}を外しました`);
  }

  function place(type: WidgetType, placement: Placement) {
    const displayTarget = target;
    saver.run(async () => {
      const res = await api.boards[":boardId"].widgets.$post({
        param: { boardId: board.id },
        json: { type, displayTarget, ...placement },
      });
      if (res.ok) {
        const created = await res.json();
        setWidgets((current) => [
          ...current.filter((w) => w.id !== created.id),
          created,
        ]);
        setSelectedId(created.id);
        announce(
          `${WIDGET_LABELS[type]}を${describePlacement(placement, GRIDS[displayTarget])}に置きました`,
        );
      }
      return res;
    });
  }

  // 文字を打っているあいだの保存は、打ち終わるまで少し待ってから送る
  const saves = useDebouncedSaves();

  function updateSettings(
    widgetId: string,
    settings: Record<string, unknown>,
    { debounce = false }: { debounce?: boolean } = {},
  ) {
    setWidgets((current) =>
      current.map((w) => (w.id === widgetId ? { ...w, settings } : w)),
    );
    const key = `settings:${widgetId}`;
    const send = () =>
      saver.run(() =>
        api.widgets[":widgetId"].$patch({
          param: { widgetId },
          json: { settings },
        }),
      );
    if (debounce) {
      saves.schedule(key, send);
    } else {
      // 待っている古い保存は捨てて、今の設定（文字の変更も入っている）を送る
      saves.cancel(key);
      send();
    }
  }

  // ToDo の項目（画面の中を先に変えてから保存する）
  function setTodoItems(
    widgetId: string,
    update: (items: TodoItem[]) => TodoItem[],
  ) {
    setWidgets((current) =>
      current.map((w) =>
        w.id === widgetId ? { ...w, todoItems: update(w.todoItems ?? []) } : w,
      ),
    );
  }

  function addTodo(widgetId: string, title: string) {
    saver.run(async () => {
      const res = await api.widgets[":widgetId"]["todo-items"].$post({
        param: { widgetId },
        json: { title },
      });
      if (res.ok) {
        const item = await res.json();
        setTodoItems(widgetId, (items) => [...items, item]);
        announce(`「${item.title}」を追加しました`);
      }
      return res;
    });
  }

  function updateTodo(
    widgetId: string,
    itemId: string,
    patch: { title?: string; isDone?: boolean },
  ) {
    setTodoItems(widgetId, (items) =>
      items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
    saver.run(() =>
      api["todo-items"][":itemId"].$patch({
        param: { itemId },
        json: patch,
      }),
    );
  }

  function deleteTodo(widgetId: string, itemId: string) {
    setTodoItems(widgetId, (items) => items.filter((i) => i.id !== itemId));
    saver.run(() =>
      api["todo-items"][":itemId"].$delete({ param: { itemId } }),
    );
  }

  function moveTodo(widgetId: string, itemId: string, toIndex: number) {
    setTodoItems(widgetId, (items) => {
      const sorted = items.toSorted((a, b) => a.sortOrder - b.sortOrder);
      const moving = sorted.find((item) => item.id === itemId);
      if (!moving) return items;
      const rest = sorted.filter((item) => item.id !== itemId);
      rest.splice(toIndex, 0, moving);
      return rest.map((item, index) => ({ ...item, sortOrder: index }));
    });
    saver.run(() =>
      api["todo-items"][":itemId"].$patch({
        param: { itemId },
        json: { sortOrder: toIndex },
      }),
    );
  }

  // メモの本文。打つたびにボードに出し、打ち終わってから保存する
  function changeMemoBody(widgetId: string, body: string) {
    setWidgets((current) =>
      current.map((w) =>
        w.id === widgetId
          ? { ...w, memo: { body, updatedAt: new Date().toISOString() } }
          : w,
      ),
    );
    saves.schedule(`memo:${widgetId}`, () =>
      saver.run(() =>
        api.widgets[":widgetId"].memo.$put({
          param: { widgetId },
          json: { body },
        }),
      ),
    );
  }

  // カレンダーの購読先とニュースのフィード（登録は結果を待ち、変更と削除は画面を先に変える）
  function updateWidget(
    widgetId: string,
    update: (w: BoardWidget) => BoardWidget,
  ) {
    setWidgets((current) =>
      current.map((w) => (w.id === widgetId ? update(w) : w)),
    );
  }

  async function addCalendar(widgetId: string, url: string) {
    let res: Response;
    try {
      res = await api.widgets[":widgetId"]["calendar-subscriptions"].$post({
        param: { widgetId },
        json: { url },
      });
    } catch {
      return "通信できませんでした。時間をおいてお試しください";
    }
    if (res.status === 401) {
      router.push("/login");
      return "ログインし直してください";
    }
    if (!res.ok) {
      return errorMessageOf(res, "登録できませんでした");
    }
    const created = (await res.json()) as CalendarSubscription;
    updateWidget(widgetId, (w) => ({
      ...w,
      calendarSubscriptions: [...(w.calendarSubscriptions ?? []), created],
    }));
    announce(`「${created.name}」を登録しました`);
    return null;
  }

  function updateCalendar(
    widgetId: string,
    subscriptionId: string,
    patch: { name?: string; color?: CalendarColor },
  ) {
    updateWidget(widgetId, (w) => ({
      ...w,
      calendarSubscriptions: (w.calendarSubscriptions ?? []).map((s) =>
        s.id === subscriptionId ? { ...s, ...patch } : s,
      ),
    }));
    saver.run(() =>
      api["calendar-subscriptions"][":subscriptionId"].$patch({
        param: { subscriptionId },
        json: patch,
      }),
    );
  }

  function deleteCalendar(widgetId: string, subscriptionId: string) {
    const name = widgets
      .find((w) => w.id === widgetId)
      ?.calendarSubscriptions?.find((s) => s.id === subscriptionId)?.name;
    updateWidget(widgetId, (w) => ({
      ...w,
      calendarSubscriptions: (w.calendarSubscriptions ?? []).filter(
        (s) => s.id !== subscriptionId,
      ),
    }));
    saver.run(() =>
      api["calendar-subscriptions"][":subscriptionId"].$delete({
        param: { subscriptionId },
      }),
    );
    announce(`「${name ?? "カレンダー"}」の登録をやめました`);
  }

  async function addFeed(widgetId: string, url: string) {
    let res: Response;
    try {
      res = await api.widgets[":widgetId"]["news-feeds"].$post({
        param: { widgetId },
        json: { url },
      });
    } catch {
      return "通信できませんでした。時間をおいてお試しください";
    }
    if (res.status === 401) {
      router.push("/login");
      return "ログインし直してください";
    }
    if (!res.ok) {
      return errorMessageOf(res, "登録できませんでした");
    }
    const created = (await res.json()) as NewsFeed;
    updateWidget(widgetId, (w) => ({
      ...w,
      newsFeeds: [...(w.newsFeeds ?? []), created],
    }));
    announce(`「${created.title}」を登録しました`);
    return null;
  }

  function renameFeed(widgetId: string, feedId: string, title: string) {
    updateWidget(widgetId, (w) => ({
      ...w,
      newsFeeds: (w.newsFeeds ?? []).map((f) =>
        f.id === feedId ? { ...f, title } : f,
      ),
    }));
    saver.run(() =>
      api["news-feeds"][":feedId"].$patch({
        param: { feedId },
        json: { title },
      }),
    );
  }

  function toggleFeed(widgetId: string, feedId: string, visible: boolean) {
    updateWidget(widgetId, (w) => ({
      ...w,
      newsFeeds: (w.newsFeeds ?? []).map((f) =>
        f.id === feedId ? { ...f, visible } : f,
      ),
    }));
    saver.run(() =>
      api["news-feeds"][":feedId"].$patch({
        param: { feedId },
        json: { visible },
      }),
    );
  }

  function moveFeed(widgetId: string, feedId: string, toIndex: number) {
    updateWidget(widgetId, (w) => {
      const sorted = (w.newsFeeds ?? []).toSorted(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      const moving = sorted.find((f) => f.id === feedId);
      if (!moving) return w;
      const rest = sorted.filter((f) => f.id !== feedId);
      rest.splice(toIndex, 0, moving);
      return {
        ...w,
        newsFeeds: rest.map((f, index) => ({ ...f, sortOrder: index })),
      };
    });
    saver.run(() =>
      api["news-feeds"][":feedId"].$patch({
        param: { feedId },
        json: { sortOrder: toIndex },
      }),
    );
  }

  function deleteFeed(widgetId: string, feedId: string) {
    updateWidget(widgetId, (w) => ({
      ...w,
      newsFeeds: (w.newsFeeds ?? []).filter((f) => f.id !== feedId),
    }));
    saver.run(() =>
      api["news-feeds"][":feedId"].$delete({ param: { feedId } }),
    );
  }

  function statusOf(type: WidgetType): PaletteStatus {
    const widget = widgets.find((w) => w.type === type);
    if (!widget) return "new";
    return placementOn(widget, target) ? "placed" : "unplaced";
  }

  // 「追加」ボタン：空いている、いちばん上・左の場所に置く
  function addToFreeSpot(type: WidgetType) {
    const others = othersOn(widgets, target);
    const spot =
      findFreeSpot(clampSize(DEFAULT_SIZES[type], grid), others, grid) ??
      findFreeSpot({ w: 1, h: 1 }, others, grid);
    if (!spot) {
      announce(
        "空いているマスがありません。どれかを外すか、小さくしてください",
      );
      return;
    }
    place(type, spot);
  }

  // 一覧からのドラッグ
  function updatePaletteDrag(type: WidgetType, x: number, y: number) {
    const cell = boardRef.current?.hitTest(x, y) ?? null;
    const drop = cell
      ? dropPlacement(type, cell, othersOn(widgets, target), target)
      : null;
    const next: PaletteDrag = {
      type,
      x,
      y,
      preview: drop
        ? {
            ...drop,
            label: drop.valid
              ? `ここに${WIDGET_LABELS[type]}を追加`
              : "ここには置けません",
          }
        : null,
    };
    paletteDragRef.current = next;
    setPaletteDrag(next);
  }

  function endPaletteDrag() {
    const drag = paletteDragRef.current;
    paletteDragRef.current = null;
    setPaletteDrag(null);
    if (drag?.preview?.valid) {
      place(drag.type, drag.preview.placement);
    } else if (drag?.preview) {
      announce("そこには置けません");
    }
  }

  const settingsWidget = widgets.find((w) => w.id === settingsId) ?? null;
  const settingsPlacement = settingsWidget
    ? placementOn(settingsWidget, target)
    : null;
  const sizeLabel = settingsPlacement
    ? `${settingsPlacement.w}×${settingsPlacement.h}`
    : "未配置";
  const design = DESIGN_SIZES[target];

  function closeSettings() {
    saves.flush();
    setSettingsId(null);
  }

  // 設定パネルを開いたまま別のウィジェットを選んだら、そのウィジェットのパネルに切り替える。
  // 選ぶのをやめたら（ボードの空いているところを押す、Esc）、パネルを閉じて一覧に戻す
  function select(widgetId: string | null) {
    setSelectedId(widgetId);
    if (!widgetId) {
      if (settingsId) closeSettings();
      return;
    }
    if (!settingsId || widgetId === settingsId) return;
    const widget = widgets.find((w) => w.id === widgetId);
    saves.flush();
    setSettingsId(widget && SETTINGS_SCHEMAS[widget.type] ? widgetId : null);
  }

  // 選んだウィジェットの種類に合わせた設定パネル
  function settingsPanel(widget: BoardWidget) {
    switch (widget.type) {
      case "clock":
        return (
          <ClockSettingsPanel
            settings={widget.settings}
            sizeLabel={sizeLabel}
            onChange={(settings) => updateSettings(widget.id, settings)}
            onClose={closeSettings}
          />
        );
      case "todo":
        return (
          <TodoSettingsPanel
            settings={widget.settings}
            items={widget.todoItems ?? []}
            sizeLabel={sizeLabel}
            onSettingsChange={(settings) => updateSettings(widget.id, settings)}
            onAdd={(title) => addTodo(widget.id, title)}
            onUpdate={(itemId, patch) => updateTodo(widget.id, itemId, patch)}
            onDelete={(itemId) => deleteTodo(widget.id, itemId)}
            onMove={(itemId, toIndex) => moveTodo(widget.id, itemId, toIndex)}
            onAnnounce={announce}
            onClose={closeSettings}
          />
        );
      case "memo":
        return (
          <MemoSettingsPanel
            settings={widget.settings}
            body={widget.memo?.body ?? ""}
            sizeLabel={sizeLabel}
            onSettingsChange={(settings) => updateSettings(widget.id, settings)}
            onBodyChange={(body) => changeMemoBody(widget.id, body)}
            onClose={closeSettings}
          />
        );
      case "countdown":
        return (
          <CountdownSettingsPanel
            settings={widget.settings}
            sizeLabel={sizeLabel}
            onSettingsChange={(settings, options) =>
              updateSettings(widget.id, settings, options)
            }
            onClose={closeSettings}
          />
        );
      case "weather":
        return (
          <WeatherSettingsPanel
            settings={widget.settings}
            sizeLabel={sizeLabel}
            onSettingsChange={(settings) => updateSettings(widget.id, settings)}
            onClose={closeSettings}
          />
        );
      case "calendar":
        return (
          <CalendarSettingsPanel
            settings={widget.settings}
            subscriptions={widget.calendarSubscriptions ?? []}
            sizeLabel={sizeLabel}
            onSettingsChange={(settings) => updateSettings(widget.id, settings)}
            onAdd={(url) => addCalendar(widget.id, url)}
            onUpdate={(subscriptionId, patch) =>
              updateCalendar(widget.id, subscriptionId, patch)
            }
            onDelete={(subscriptionId) =>
              deleteCalendar(widget.id, subscriptionId)
            }
            onClose={closeSettings}
          />
        );
      case "news":
        return (
          <NewsSettingsPanel
            settings={widget.settings}
            feeds={widget.newsFeeds ?? []}
            sizeLabel={sizeLabel}
            width={settingsPlacement?.w ?? null}
            onSettingsChange={(settings) => updateSettings(widget.id, settings)}
            onAdd={(url) => addFeed(widget.id, url)}
            onRename={(feedId, title) => renameFeed(widget.id, feedId, title)}
            onToggle={(feedId, visible) =>
              toggleFeed(widget.id, feedId, visible)
            }
            onMove={(feedId, toIndex) => moveFeed(widget.id, feedId, toIndex)}
            onDelete={(feedId) => deleteFeed(widget.id, feedId)}
            onAnnounce={announce}
            onClose={closeSettings}
          />
        );
    }
  }
  const panel = settingsWidget ? settingsPanel(settingsWidget) : null;

  return (
    <>
      <div className="flex h-dvh flex-col max-md:hidden">
        <EditorHeader
          boardName={board.name}
          saveStatus={saver.status}
          user={user}
        />

        <div className="flex min-h-0 flex-1">
          {!collapsed && (
            <aside className="w-80 shrink-0 border-r border-line bg-surface">
              {panel ?? (
                <WidgetPalette
                  statusOf={statusOf}
                  draggingType={paletteDrag?.type ?? null}
                  onAdd={addToFreeSpot}
                  onDragStart={updatePaletteDrag}
                  onDragMove={(x, y) => {
                    const type = paletteDragRef.current?.type;
                    if (type) updatePaletteDrag(type, x, y);
                  }}
                  onDragEnd={endPaletteDrag}
                  onCollapse={() => setCollapsed(true)}
                />
              )}
            </aside>
          )}

          <main className="flex min-w-0 flex-1 flex-col gap-4 bg-canvas p-6">
            <h1 className="sr-only">ボードを編集</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {collapsed && (
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  aria-label="一覧を開く"
                  title="一覧を開く"
                  className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-ink-2 hover:text-ink"
                >
                  <PanelLeftOpen aria-hidden className="size-4" />
                </button>
              )}
              <label className="flex items-center gap-2 text-ink-3">
                表示先
                <span className="relative flex items-center">
                  <Monitor
                    aria-hidden
                    className="pointer-events-none absolute left-3 size-4 text-ink-2"
                  />
                  <select
                    value={target}
                    onChange={(event) => {
                      setChosenTarget(event.target.value as DisplayTarget);
                      setSelectedId(null);
                    }}
                    className="h-9 rounded-lg border border-line bg-surface pr-3 pl-9 font-bold text-ink"
                  >
                    {DISPLAY_TARGETS.map((t) => (
                      <option key={t} value={t}>
                        {DISPLAY_TARGET_LABELS[t]}（{DESIGN_SIZES[t].width}×
                        {DESIGN_SIZES[t].height}）
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <span className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-2">
                <Grid2x2 aria-hidden className="size-3.5" />
                グリッド {grid.cols}×{grid.rows}
                {grid.pages > 1 && `・${grid.pages}ページ`}
              </span>
              <span className="text-xs text-ink-3">
                {design.width}×{design.height}
              </span>
            </div>

            <div className="flex min-h-0 flex-1 rounded-2xl border border-line bg-surface p-6">
              <EditBoard
                ref={boardRef}
                widgets={widgets}
                target={target}
                selectedId={selectedId}
                dropPreview={paletteDrag?.preview ?? null}
                onSelect={select}
                onCommit={commitPlacement}
                onRemove={removeFromTarget}
                onOpenSettings={(widgetId) => {
                  setSettingsId(widgetId);
                  setCollapsed(false);
                }}
                onAnnounce={announce}
              />
            </div>

            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-ink-3">
              <li className="flex items-center gap-1.5">
                <MousePointerClick aria-hidden className="size-3.5" />
                クリックで設定
              </li>
              <li className="flex items-center gap-1.5">
                <Move aria-hidden className="size-3.5" />
                ドラッグで移動
              </li>
              <li className="flex items-center gap-1.5">
                <Scaling aria-hidden className="size-3.5" />
                右下の角をドラッグしてサイズ変更
              </li>
              <li className="flex items-center gap-1.5">
                <Keyboard aria-hidden className="size-3.5" />
                矢印キーで移動、Enter で操作メニュー
              </li>
            </ul>
          </main>
        </div>

        {/* 一覧からドラッグしているあいだ、指の横に出す小さなカード */}
        {paletteDrag && (
          <DragGhost
            type={paletteDrag.type}
            x={paletteDrag.x}
            y={paletteDrag.y}
          />
        )}

        {/* 操作の結果を読み上げる */}
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>

      {/* スマホでの編集は「余裕があれば」の機能なので、狭い画面では案内だけを出す */}
      <main className="grid min-h-dvh place-items-center p-8 text-center md:hidden">
        <div>
          <h1 className="text-xl font-bold">編集は PC かタブレットで</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            スマホの画面では、ボードを編集できません。
            <br />
            PC かタブレットで開いてください。
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-11 items-center rounded-[10px] bg-accent px-5 font-bold text-on-accent"
          >
            表示モードへ
          </Link>
        </div>
      </main>
    </>
  );
}

function DragGhost({ type, x, y }: { type: WidgetType; x: number; y: number }) {
  const Icon = WIDGET_ICONS[type];
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 flex -rotate-3 items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm font-bold shadow-2xl"
      style={{ left: x + 12, top: y + 12 }}
    >
      <Icon className="size-4 text-accent-ink" />
      {WIDGET_LABELS[type]}
    </div>
  );
}
