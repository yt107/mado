"use client";

import { Cloud, CloudOff, Expand, LoaderCircle, Monitor } from "lucide-react";
import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";

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
