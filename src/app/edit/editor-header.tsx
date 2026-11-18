"use client";

import {
  ChevronDown,
  CircleUser,
  Cloud,
  CloudOff,
  Expand,
  LoaderCircle,
  LogOut,
  Monitor,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";

import type { SaveStatus } from "./use-save-queue";

type Props = {
  boardName: string;
  saveStatus: SaveStatus;
  user: { name: string; email: string };
};

const SAVE_LABELS: Record<SaveStatus, string> = {
  saving: "保存中…",
  saved: "自動保存済み",
  failed: "保存できませんでした",
};

export function EditorHeader({ boardName, saveStatus, user }: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-5">
      <Logo />
      <span className="ml-3 flex items-center gap-2 rounded-lg bg-raised px-3 py-1.5 text-sm">
        <Monitor aria-hidden className="size-4 text-ink-2" />
        {boardName}
      </span>
      <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent-ink">
        <span aria-hidden className="size-1.5 rounded-full bg-accent" />
        編集中
      </span>

      <p
        role="status"
        className={
          saveStatus === "failed"
            ? "ml-auto flex items-center gap-1.5 text-xs text-danger"
            : "ml-auto flex items-center gap-1.5 text-xs text-ink-3"
        }
      >
        {saveStatus === "saving" ? (
          <LoaderCircle
            aria-hidden
            className="size-3.5 motion-safe:animate-spin"
          />
        ) : saveStatus === "failed" ? (
          <CloudOff aria-hidden className="size-3.5" />
        ) : (
          <Cloud aria-hidden className="size-3.5" />
        )}
        {SAVE_LABELS[saveStatus]}
      </p>

      <Link
        href="/"
        className="flex h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent hover:opacity-90"
      >
        <Expand aria-hidden className="size-4" />
        表示モードへ
      </Link>

      <AccountMenu user={user} />
    </header>
  );
}

// 右上のアカウントメニュー。ブラウザの popover で開き、外を押すか Esc で閉じる
function AccountMenu({ user }: { user: Props["user"] }) {
  const router = useRouter();
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  function signOut() {
    void authClient.signOut({
      fetchOptions: {
        // ログアウトできたら、ログインの画面へ移す
        onSuccess: () => router.push("/login"),
      },
    });
  }

  return (
    <>
      <button
        type="button"
        popoverTarget="account-menu"
        className="flex h-10 items-center gap-2 rounded-[10px] px-2 hover:bg-raised"
      >
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-full bg-avatar text-xs font-bold text-white"
        >
          {initial}
        </span>
        <span className="max-w-32 truncate text-sm">{user.name}</span>
        <ChevronDown aria-hidden className="size-4 text-ink-3" />
      </button>
      <div
        id="account-menu"
        popover="auto"
        // 右上のボタンの下に出す（ブラウザの top layer に出るので、場所は画面に対して決める）
        className="fixed inset-auto top-16 right-4 m-0 w-64 rounded-xl border border-line bg-card p-1.5 text-sm text-ink shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-3 pt-2 pb-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-avatar font-bold text-white"
          >
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold">{user.name}</span>
            <span className="block truncate text-xs text-ink-3">
              {user.email}
            </span>
          </span>
        </div>
        {/* マイページは、まとまり5で作る。それまでは押しても何もしない */}
        <button
          type="button"
          aria-disabled="true"
          title="マイページは準備中です"
          className="mt-1 flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-left text-ink-3"
        >
          <CircleUser aria-hidden className="size-4" />
          マイページ
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-raised"
        >
          <LogOut aria-hidden className="size-4" />
          ログアウト
        </button>
      </div>
    </>
  );
}
