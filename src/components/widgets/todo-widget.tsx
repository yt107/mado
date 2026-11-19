"use client";

import { Check, ListTodo } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api-client";
import type { BoardWidget } from "@/lib/board/schema";
import { cx } from "@/lib/cx";
import {
  readTodoSettings,
  visibleTodoItems,
  type TodoItem,
} from "@/lib/widgets/todo";

type Props = {
  widget: BoardWidget;
  // 表示モードでは、項目のチェックだけができる（No 27）
  interactive?: boolean;
};

// 押したあと、保存の結果が来るまでの見た目。サーバーの値が変わったら、そちらを使う
type Override = { from: boolean; to: boolean };

export function TodoWidget({ widget, interactive = false }: Props) {
  const router = useRouter();
  const settings = readTodoSettings(widget.settings);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  const items: TodoItem[] = (widget.todoItems ?? []).map((item) => {
    const override = overrides[item.id];
    return override && override.from === item.isDone
      ? { ...item, isDone: override.to }
      : item;
  });
  const visible = visibleTodoItems(items, settings);
  const remaining = items.filter((item) => !item.isDone).length;

  async function toggle(item: TodoItem) {
    const original = widget.todoItems?.find((i) => i.id === item.id);
    if (!original) return;
    setOverrides((current) => ({
      ...current,
      [item.id]: { from: original.isDone, to: !item.isDone },
    }));
    const res = await api["todo-items"][":itemId"].$patch({
      param: { itemId: item.id },
      json: { isDone: !item.isDone },
    });
    if (res.ok) {
      // ほかの端末にも同じ内容が出るよう、ボードを読み直す
      router.refresh();
    } else {
      // 保存できなければ、元に戻す
      setOverrides((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-[0.5em]">
        <p className="flex items-center gap-[0.4em] font-bold">
          <ListTodo aria-hidden className="size-[1.05em]" />
          ToDo
        </p>
        <p className="text-[0.85em] text-ink-3">残り{remaining}件</p>
      </div>

      {items.length === 0 ? (
        <p className="mt-[0.8em] text-[0.9em] text-ink-3">
          項目がまだありません
        </p>
      ) : (
        // 入りきらない項目は、下を切って見せる（1×1 は入る件数まで）
        <ul className="mt-[0.8em] flex min-h-0 flex-1 flex-col gap-[0.6em] overflow-hidden">
          {visible.map((item) => (
            <li key={item.id} className="shrink-0">
              {interactive ? (
                <label className="flex cursor-pointer items-center gap-[0.6em]">
                  <input
                    type="checkbox"
                    checked={item.isDone}
                    onChange={() => void toggle(item)}
                    className="peer sr-only"
                  />
                  <CheckMark done={item.isDone} />
                  <ItemTitle item={item} />
                </label>
              ) : (
                <span className="flex items-center gap-[0.6em]">
                  <CheckMark done={item.isDone} />
                  <ItemTitle item={item} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckMark({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid size-[1.25em] shrink-0 place-items-center rounded-full border-[0.12em] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
        done ? "border-accent bg-accent text-on-accent" : "border-ink-3",
      )}
    >
      {done && <Check className="size-[0.8em]" strokeWidth={3} />}
    </span>
  );
}

function ItemTitle({ item }: { item: TodoItem }) {
  return (
    <span className={cx("truncate", item.isDone && "text-ink-3")}>
      {item.title}
    </span>
  );
}
