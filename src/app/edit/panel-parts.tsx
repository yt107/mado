"use client";

import { X, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

// 設定パネルの共通の部品（枠、スイッチ、切り替えボタン）

type ShellProps = {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
};

// パネルの枠。上に名前と閉じるボタン、下に「完了」
export function PanelShell({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  onClose,
  children,
}: ShellProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-line px-5 py-5">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white"
          style={{ backgroundColor: iconColor }}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="設定を閉じる"
          className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5 text-sm">
        {children}
      </div>
      <div className="flex justify-end border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-[10px] bg-ink px-5 text-sm font-bold text-canvas hover:opacity-90"
        >
          完了
        </button>
      </div>
    </div>
  );
}

// オンとオフの切り替え（チェックボックスを、スイッチとして読み上げる）
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      {label}
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-10 rounded-full bg-raised transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

// いくつかから1つを選ぶ（ラジオボタンを、並んだボタンの見た目にする）
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold text-ink-2">{legend}</legend>
      <div
        className="grid gap-1 rounded-xl bg-raised p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      >
        {options.map(([option, label]) => (
          <label
            key={option}
            className="cursor-pointer rounded-lg px-2 py-2 text-center text-xs text-ink-2 has-checked:bg-card has-checked:font-bold has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// 日本語の入力で、変換を決める Enter かどうか（そのときは送らない）
export function isComposing(event: React.KeyboardEvent) {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}
