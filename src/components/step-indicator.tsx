import { Check, ChevronRight } from "lucide-react";

import { cx } from "@/lib/cx";

// はじめるまでの手順（Googleでログイン → 確認 → テンプレート → 地域と表示画面）
const STEPS = ["Googleでログイン", "確認", "テンプレート", "地域と表示画面"];

type Props = {
  // 今の手順（1から数える）
  current: number;
  // pill：枠で囲む（ログインの画面）、plain：線でつなぐ（テンプレートの画面の上）
  variant?: "pill" | "plain";
  className?: string;
};

export function StepIndicator({ current, variant = "pill", className }: Props) {
  return (
    <ol
      aria-label="はじめるまでの手順"
      className={cx("flex flex-wrap items-center gap-2", className)}
    >
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-2"
          >
            {i > 0 &&
              (variant === "pill" ? (
                <ChevronRight aria-hidden className="size-3.5 text-ink-3" />
              ) : (
                <span aria-hidden className="h-px w-6 bg-line" />
              ))}
            <span
              className={cx(
                "flex items-center gap-2 text-xs",
                variant === "pill" && "rounded-full border py-1 pr-3 pl-1",
                variant === "pill" &&
                  (active ? "border-accent/30 bg-accent/10" : "border-line"),
                active ? "font-bold text-accent-ink" : "text-ink-2",
                variant === "plain" && active && "text-ink",
              )}
            >
              <span
                className={cx(
                  "grid size-5 place-items-center rounded-full text-[0.7rem] font-bold",
                  active ? "bg-accent text-on-accent" : "bg-raised text-ink-2",
                )}
              >
                {done ? (
                  <Check aria-label="済み" className="size-3 text-[#4cd38a]" />
                ) : (
                  step
                )}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
