"use client";

import { ChevronDown, CircleUser, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

type User = { name: string; email: string };

// 名前の頭文字（アバターに出す）
export function initialOf(user: User) {
  return (user.name || user.email).charAt(0).toUpperCase();
}

// ログアウトして、ログインの画面へ移る
export function useSignOut() {
  const router = useRouter();
  return () => {
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/login"),
      },
    });
  };
}

// 右上のアカウントメニュー。ブラウザの popover で開き、外を押すか Esc で閉じる
export function AccountMenu({ user }: { user: User }) {
  const signOut = useSignOut();
  const initial = initialOf(user);

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
        <Link
          href="/mypage"
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-raised"
        >
          <CircleUser aria-hidden className="size-4" />
          マイページ
        </Link>
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
