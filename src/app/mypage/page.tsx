import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { getMyDataCounts } from "@/lib/board/data";
import { verifyConsentedUser } from "@/lib/session";

import { ProfileCard } from "./profile-card";
import { WithdrawCard } from "./withdraw-card";

export const metadata: Metadata = {
  title: "マイページ",
};

// マイページ（メールアドレスと登録日、ユーザー名の変更、ログアウト、退会）
export default function MyPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      {/* ログイン状態はリクエストごとに読むので、Suspense の中に置く */}
      <Suspense
        fallback={
          <p className="grid min-h-dvh place-items-center text-ink-3">
            読み込み中…
          </p>
        }
      >
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await verifyConsentedUser();
  const counts = await getMyDataCounts(user.id);

  return (
    <>
      <header className="flex h-16 items-center gap-4 border-b border-line bg-surface px-5">
        <Logo />
        <span aria-hidden className="h-6 w-px bg-line" />
        <Link
          href="/edit"
          className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm whitespace-nowrap text-ink-2 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {/* 狭い画面では短くする */}
          <span className="sm:hidden">戻る</span>
          <span className="hidden sm:inline">ダッシュボードに戻る</span>
        </Link>
        <span className="ml-auto">
          <AccountMenu user={{ name: user.name, email: user.email }} />
        </span>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-10">
        <div className="max-w-130">
          <h1 className="text-3xl font-bold">マイページ</h1>
          <p className="mt-2 text-sm text-ink-2">アカウントを管理します。</p>

          <ProfileCard
            className="mt-8"
            user={{
              name: user.name,
              email: user.email,
              createdAt: user.createdAt.toISOString(),
            }}
          />
          <WithdrawCard
            className="mt-6"
            user={{ id: user.id, email: user.email }}
            counts={counts}
          />
        </div>
      </main>
    </>
  );
}
