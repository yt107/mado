"use client";

import { StickyNote } from "lucide-react";
import { useId } from "react";

import { cx } from "@/lib/cx";
import {
  MEMO_BODY_MAX,
  MEMO_COLORS,
  readMemoSettings,
  type MemoSettings,
} from "@/lib/widgets/memo";

import { PanelShell, Segmented } from "./panel-parts";

type Props = {
  settings: Record<string, unknown>;
  body: string;
  sizeLabel: string;
  onSettingsChange: (settings: MemoSettings) => void;
  onBodyChange: (body: string) => void;
  onClose: () => void;
};

const COLOR_LABELS: Record<MemoSettings["color"], [string, string]> = {
  yellow: ["黄色", "#efdfae"],
  pink: ["ピンク", "#f2c4ce"],
  blue: ["水色", "#c7ddf2"],
  green: ["緑", "#cde8c7"],
  dark: ["黒", "#2a2f38"],
};

// メモの設定（画面設計「ウィジェット設定（メモ）」）。本文は打つたびにボードに出て、少し待ってから保存する
export function MemoSettingsPanel({
  settings,
  body,
  sizeLabel,
  onSettingsChange,
  onBodyChange,
  onClose,
}: Props) {
  const s = readMemoSettings(settings);
  const id = useId();

  return (
    <PanelShell
      icon={StickyNote}
      iconColor="#c9a33d"
      title="メモの設定"
      subtitle={`${sizeLabel}・変更はすぐボードに反映`}
      onClose={onClose}
    >
      <div>
        <label
          htmlFor={`${id}-body`}
          className="mb-2 block text-xs font-bold text-ink-2"
        >
          本文
        </label>
        <textarea
          id={`${id}-body`}
          value={body}
          maxLength={MEMO_BODY_MAX}
          rows={8}
          aria-describedby={`${id}-count`}
          onChange={(event) => onBodyChange(event.target.value)}
          className="w-full resize-y rounded-[10px] border border-line bg-card p-3 leading-relaxed focus:border-accent"
        />
        <p id={`${id}-count`} className="mt-1 text-right text-xs text-ink-3">
          {body.length} / {MEMO_BODY_MAX}
        </p>
      </div>

      <Segmented
        legend="文字の大きさ"
        value={s.fontSize}
        options={[
          ["small", "小"],
          ["medium", "中"],
          ["large", "大"],
        ]}
        onChange={(fontSize) => onSettingsChange({ ...s, fontSize })}
      />

      <fieldset>
        <legend className="mb-2 text-xs font-bold text-ink-2">背景</legend>
        <div className="flex gap-2.5">
          {MEMO_COLORS.map((color) => {
            const [label, value] = COLOR_LABELS[color];
            return (
              <label
                key={color}
                title={label}
                className="grid size-9 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface has-checked:ring-2 has-checked:ring-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-accent"
              >
                <input
                  type="radio"
                  name={`${id}-color`}
                  value={color}
                  checked={s.color === color}
                  onChange={() => onSettingsChange({ ...s, color })}
                  aria-label={label}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cx(
                    "size-8 rounded-full",
                    color === "dark" && "border border-line",
                  )}
                  style={{ backgroundColor: value }}
                />
              </label>
            );
          })}
        </div>
      </fieldset>
    </PanelShell>
  );
}
