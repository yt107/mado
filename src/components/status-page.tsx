import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import { Logo } from "./logo";

type Props = {
  icon: LucideIcon;
  // アイコンの色（ふつう、うまくいった、まずい）
  tone?: "neutral" | "success" | "danger";
  // 待っているあいだは、アイコンを回す
  spin?: boolean;
  title: string;
  children: ReactNode;
  // 下に並べるボタンやリンク
  actions?: ReactNode;
};

const TONES = {
  neutral: "bg-raised text-ink-2",
  success: "bg-accent/15 text-accent-ink",
  danger: "bg-danger/15 text-danger",
} as const;

// 1つのことだけを伝える画面（ページが見つからない、エラー、退会しました など）
export function StatusPage({
  icon: Icon,
  tone = "neutral",
  spin = false,
  title,
  children,
  actions,
}: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 py-8 sm:px-16 sm:py-10">
      <Link href="/" className="self-start rounded-lg">
        <Logo />
      </Link>
      <main className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-100 text-center">
          <span
            aria-hidden
            className={cx(
              "mx-auto grid size-14 place-items-center rounded-full",
              TONES[tone],
            )}
          >
            <Icon
              className={cx("size-7", spin && "motion-safe:animate-spin")}
            />
          </span>
          <h1 className="mt-6 text-2xl font-bold">{title}</h1>
          <div className="mt-3 text-sm leading-relaxed text-ink-2">
            {children}
          </div>
          {actions && (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {actions}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// StatusPage の下に置く、目立つボタンの見た目
export const PRIMARY_ACTION =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-ink px-5 text-sm font-bold text-canvas hover:opacity-90";

// StatusPage の下に置く、控えめなボタンの見た目
export const SECONDARY_ACTION =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-line bg-card px-5 text-sm font-bold hover:bg-raised";
