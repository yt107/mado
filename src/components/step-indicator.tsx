import { Check } from "lucide-react";

import { cx } from "@/lib/cx";

// はじめるまでの手順（Googleでログイン → テンプレート → 地域）。テンプレートの画面の上に出す。
// 画面設計の「地域と表示画面」は、表示画面を選ばないことにしたので「地域」だけにした（docs/er.md）
const STEPS = ["Googleでログイン", "テンプレート", "地域"];

type Props = {
  // 今の手順（1から数える）
  current: number;
  className?: string;
};

export function StepIndicator({ current, className }: Props) {
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
            {i > 0 && <span aria-hidden className="h-px w-6 bg-line" />}
            <span
              className={cx(
                "flex items-center gap-2 text-xs",
                active ? "font-bold text-ink" : "text-ink-2",
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
