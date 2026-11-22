"use client";

import {
  Monitor,
  RectangleHorizontal,
  Smartphone,
  Tablet,
  type LucideIcon,
} from "lucide-react";

import type { DisplayTarget } from "@/lib/board/display-targets";
import { cx } from "@/lib/cx";

// プレビューで選べる表示先（画面設計のプレビューのタブと同じ4つ）
const OPTIONS: { target: DisplayTarget; label: string; Icon: LucideIcon }[] = [
  { target: "pc", label: "PC・モニター", Icon: Monitor },
  { target: "tablet_landscape", label: "タブレット", Icon: Tablet },
  {
    target: "sub_display",
    label: "サブディスプレイ",
    Icon: RectangleHorizontal,
  },
  { target: "phone_portrait", label: "スマホ", Icon: Smartphone },
];

type Props = {
  name: string;
  value: DisplayTarget;
  onChange: (target: DisplayTarget) => void;
  className?: string;
};

// プレビューする表示先を選ぶ。ふつうのラジオボタンなので、矢印キーでも選べる
export function TargetPicker({ name, value, onChange, className }: Props) {
  return (
    <fieldset className={cx("min-w-0", className)}>
      <legend className="sr-only">プレビューする表示先</legend>
      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
        {OPTIONS.map(({ target, label, Icon }) => (
          <label
            key={target}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs whitespace-nowrap xl:px-3 text-ink-2 has-checked:bg-raised has-checked:font-bold has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent hover:text-ink"
          >
            <input
              type="radio"
              name={name}
              value={target}
              checked={value === target}
              onChange={() => onChange(target)}
              className="sr-only"
            />
            <Icon aria-hidden className="size-3.5" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
