"use client";

import { Check, GripVertical, Info, ListTodo, Plus, X } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";

import { cx } from "@/lib/cx";
import {
  readTodoSettings,
  TODO_ITEMS_MAX,
  TODO_TITLE_MAX,
  type TodoItem,
  type TodoSettings,
} from "@/lib/widgets/todo";

import { isComposing, PanelShell, Switch } from "./panel-parts";

type Props = {
  settings: Record<string, unknown>;
  items: TodoItem[];
  sizeLabel: string;
  onSettingsChange: (settings: TodoSettings) => void;
  onAdd: (title: string) => void;
  onUpdate: (
    itemId: string,
    patch: { title?: string; isDone?: boolean },
  ) => void;
  onDelete: (itemId: string) => void;
  onMove: (itemId: string, toIndex: number) => void;
  onAnnounce: (message: string) => void;
  onClose: () => void;
};

// ToDo の設定（画面設計「ウィジェット設定（ToDo）」）。項目の追加・完了・名前の変更・削除・並べ替え
export function TodoSettingsPanel({
  settings,
  items,
  sizeLabel,
  onSettingsChange,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
  onAnnounce,
  onClose,
}: Props) {
  const s = readTodoSettings(settings);
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  // つまみをドラッグして並べ替える。動かしているあいだは、落とす場所に並べて見せる
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ id: string; index: number } | null>(null);
  const ordered = drag
    ? (() => {
        const rest = sorted.filter((item) => item.id !== drag.id);
        const moving = sorted.find((item) => item.id === drag.id);
        return moving
          ? [...rest.slice(0, drag.index), moving, ...rest.slice(drag.index)]
          : sorted;
      })()
    : sorted;

  function indexAt(clientY: number, movingId: string) {
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-item]") ?? [],
    ).filter((row) => row.dataset.item !== movingId);
    // 指より上にある項目の数が、落とす場所の番号
    return rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top + rect.height / 2 < clientY;
    }).length;
  }

  function startDrag(event: PointerEvent<HTMLElement>, item: TodoItem) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id: item.id, index: sorted.indexOf(item) });
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    if (!drag) return;
    const index = indexAt(event.clientY, drag.id);
    if (index !== drag.index) setDrag({ ...drag, index });
  }

  function endDrag() {
    if (!drag) return;
    const from = sorted.findIndex((item) => item.id === drag.id);
    if (from !== drag.index) {
      onMove(drag.id, drag.index);
      onAnnounce(`${drag.index + 1}番目に動かしました`);
    }
    setDrag(null);
  }

  function moveByKey(item: TodoItem, delta: number) {
    const from = sorted.indexOf(item);
    const to = from + delta;
    if (to < 0 || to >= sorted.length) return;
    onMove(item.id, to);
    onAnnounce(`「${item.title}」を${to + 1}番目に動かしました`);
  }

  const [draft, setDraft] = useState("");
  const full = items.length >= TODO_ITEMS_MAX;

  return (
    <PanelShell
      icon={ListTodo}
      iconColor="#3fae74"
      title="ToDoの設定"
      subtitle={`${sizeLabel}・変更はすぐボードに反映`}
      onClose={onClose}
    >
      <section aria-labelledby="todo-items">
        <h3 id="todo-items" className="mb-2 text-xs font-bold text-ink-2">
          項目
        </h3>
        <ul ref={listRef} className="flex flex-col gap-1.5">
          {ordered.map((item, index) => (
            <li
              key={item.id}
              data-item={item.id}
              className={cx(
                "flex items-center gap-1 rounded-lg bg-raised py-1 pr-1 pl-1",
                drag?.id === item.id && "opacity-60 ring-2 ring-accent",
              )}
            >
              {/* つまみ：ドラッグで並べ替え。選んで ↑↓ キーでも動かせる */}
              <button
                type="button"
                aria-label={`「${item.title}」を並べ替える（${index + 1}番目。↑↓キーで動かす）`}
                className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-3 select-none hover:text-ink"
                onPointerDown={(event) => startDrag(event, item)}
                onPointerMove={moveDrag}
                onLostPointerCapture={endDrag}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    moveByKey(item, event.key === "ArrowUp" ? -1 : 1);
                  }
                }}
              >
                <GripVertical aria-hidden className="size-4" />
              </button>
              <label className="grid size-7 shrink-0 cursor-pointer place-items-center">
                <input
                  type="checkbox"
                  checked={item.isDone}
                  onChange={() => onUpdate(item.id, { isDone: !item.isDone })}
                  aria-label={`「${item.title}」を完了にする`}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cx(
                    "grid size-4.5 place-items-center rounded-full border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                    item.isDone
                      ? "border-accent bg-accent text-on-accent"
                      : "border-ink-3",
                  )}
                >
                  {item.isDone && <Check className="size-3" strokeWidth={3} />}
                </span>
              </label>
              <input
                type="text"
                defaultValue={item.title}
                maxLength={TODO_TITLE_MAX}
                aria-label="項目の名前"
                // 名前は、入力欄から離れたときか Enter で保存する
                onBlur={(event) => {
                  const title = event.target.value.trim();
                  if (title && title !== item.title) {
                    onUpdate(item.id, { title });
                  } else {
                    event.target.value = item.title;
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !isComposing(event)) {
                    event.currentTarget.blur();
                  }
                }}
                className={cx(
                  "min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1",
                  item.isDone && "text-ink-3",
                )}
              />
              <button
                type="button"
                onClick={() => {
                  onDelete(item.id);
                  onAnnounce(`「${item.title}」を消しました`);
                }}
                aria-label={`「${item.title}」を消す`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-card hover:text-ink"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <label className="mt-2 flex items-center gap-2 rounded-[10px] border border-line bg-card px-3">
          <Plus aria-hidden className="size-4 shrink-0 text-ink-3" />
          <span className="sr-only">項目を追加</span>
          <input
            type="text"
            value={draft}
            maxLength={TODO_TITLE_MAX}
            disabled={full}
            placeholder={
              full
                ? `項目は${TODO_ITEMS_MAX}件までです`
                : "項目を追加（Enterで追加）"
            }
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isComposing(event)) {
                event.preventDefault();
                const title = draft.trim();
                if (title) {
                  onAdd(title);
                  setDraft("");
                }
              }
            }}
            className="h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3"
          />
        </label>
      </section>

      <section aria-labelledby="todo-display" className="flex flex-col gap-3">
        <h3 id="todo-display" className="text-xs font-bold text-ink-2">
          表示
        </h3>
        <Switch
          label="完了した項目を表示"
          checked={s.showCompleted}
          onChange={(showCompleted) =>
            onSettingsChange({ ...s, showCompleted })
          }
        />
        <Switch
          label="完了した項目を下に移動"
          checked={s.completedToBottom}
          onChange={(completedToBottom) =>
            onSettingsChange({ ...s, completedToBottom })
          }
        />
      </section>

      <p className="flex gap-1.5 text-xs leading-relaxed text-ink-3">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        表示モードでは、項目のチェックだけができます。
      </p>
    </PanelShell>
  );
}
