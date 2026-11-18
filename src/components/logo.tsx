import { LayoutGrid } from "lucide-react";

import { cx } from "@/lib/cx";

// Mado のロゴ（オレンジの角丸の四角と、名前）
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-flex items-center gap-2.5 font-bold", className)}
    >
      <span className="grid size-7 place-items-center rounded-lg bg-accent text-on-accent">
        <LayoutGrid aria-hidden className="size-4" />
      </span>
      <span className="text-lg">Mado</span>
    </span>
  );
}
