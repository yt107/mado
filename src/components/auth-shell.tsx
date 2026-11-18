import type { ReactNode } from "react";

import { Logo } from "./logo";

type Props = {
  children: ReactNode;
  heroTitle: string;
  heroDescription: ReactNode;
  // 右側の見本と、その下に出すもの
  hero: ReactNode;
};

// ログインと確認の画面の枠。左にフォーム、右（広い画面だけ）にボードの見本
export function AuthShell({
  children,
  heroTitle,
  heroDescription,
  hero,
}: Props) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)]">
      <div className="flex flex-col bg-surface px-6 py-8 sm:px-16 sm:py-10 lg:border-r lg:border-line">
        <Logo />
        <main className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-100">{children}</div>
        </main>
        <footer className="text-xs text-ink-3">© 2026 Mado</footer>
      </div>

      <aside
        aria-label="Mado の見本"
        className="hidden flex-col items-center justify-center gap-12 bg-[radial-gradient(ellipse_at_50%_110%,color-mix(in_oklab,var(--c-accent)_7%,transparent),transparent_60%)] px-12 py-16 lg:flex"
      >
        <div className="text-center">
          <h2 className="text-4xl leading-tight font-bold text-balance">
            {heroTitle}
          </h2>
          <p className="mt-5 leading-relaxed text-ink-2">{heroDescription}</p>
        </div>
        {hero}
      </aside>
    </div>
  );
}
