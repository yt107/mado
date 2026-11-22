"use client";

import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import { initialOf, useSignOut } from "@/components/account-menu";
import { api } from "@/lib/api-client";
import { cx } from "@/lib/cx";

const UNEXPECTED_ERROR =
  "保存できませんでした。時間をおいて、もう一度お試しください";

type Props = {
  className?: string;
  user: { name: string; email: string; createdAt: string };
};

// プロフィール（メールアドレスと登録日、ユーザー名の変更、ログアウト）
export function ProfileCard({ className, user }: Props) {
  const router = useRouter();
  const signOut = useSignOut();
  const [name, setName] = useState(user.name);
  // 最後に保存できた名前。入力がこれと同じなら、保存ボタンを押せないようにする
  const [savedName, setSavedName] = useState(user.name);
  const [message, setMessage] = useState<{
    kind: "saved" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = name.trim();
  const canSave = trimmed !== "" && trimmed !== savedName && !isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await api.me.$patch({ json: { name: trimmed } });
      // ログインが切れていたら、ログインの画面へ。401 はミドルウェアが返すので、数として比べる
      if ((res.status as number) === 401) {
        router.push("/login");
        return;
      }
      if (res.ok) {
        const me = await res.json();
        setSavedName(me.name);
        setName(me.name);
        setMessage({ kind: "saved", text: "保存しました" });
        // 右上のメニューの名前も新しくする
        router.refresh();
        return;
      }
      if (res.status === 400) {
        const body = await res.json();
        setMessage({ kind: "error", text: body.error.message });
        return;
      }
      setMessage({ kind: "error", text: UNEXPECTED_ERROR });
    });
  }

  return (
    <section
      aria-labelledby="profile-title"
      className={cx("rounded-2xl border border-line bg-card p-6", className)}
    >
      <h2 id="profile-title" className="font-bold">
        プロフィール
      </h2>

      <div className="mt-5 flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-13 shrink-0 place-items-center rounded-full bg-avatar text-lg font-bold text-white"
        >
          {initialOf({ name: savedName, email: user.email })}
        </span>
        <div className="min-w-0">
          <p className="truncate">{user.email}</p>
          <p className="mt-0.5 text-xs text-ink-3">
            Googleアカウントで登録・
            <LocalDate iso={user.createdAt} />
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6">
        <label htmlFor="name" className="text-sm text-ink-2">
          ユーザー名
        </label>
        <div className="mt-2 flex gap-2.5">
          <div className="relative flex-1">
            <User
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-3"
            />
            <input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setMessage(null);
              }}
              required
              maxLength={50}
              autoComplete="nickname"
              className="h-12 w-full rounded-[10px] border border-line bg-canvas pr-4 pl-11"
            />
          </div>
          <button
            type="submit"
            disabled={!canSave}
            className="h-12 rounded-[10px] border border-line px-4 text-sm font-bold hover:bg-raised disabled:font-normal disabled:text-ink-3 disabled:hover:bg-transparent"
          >
            保存
          </button>
        </div>
        {/* 保存できた・できなかったことを伝える。出たら、読み上げる */}
        <p
          role="status"
          className={cx(
            "mt-2 min-h-5 text-sm",
            message?.kind === "error" ? "text-danger" : "text-ink-2",
          )}
        >
          {message?.text}
        </p>
      </form>

      <div className="mt-2 flex items-center justify-between gap-4 border-t border-line pt-5">
        <div>
          <p className="text-sm font-bold">ログアウト</p>
          <p className="mt-0.5 text-xs text-ink-3">
            このブラウザからログアウトします
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-line px-4 text-sm font-bold hover:bg-raised"
        >
          <LogOut aria-hidden className="size-4" />
          ログアウト
        </button>
      </div>
    </section>
  );
}

const subscribeNothing = () => () => {};

// 日付を「2026年11月7日」の形で、端末のタイムゾーンで出す。
// サーバーとブラウザでタイムゾーンが違うと日付がずれるので、サーバーでは出さない
function LocalDate({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  if (!isClient) {
    return null;
  }
  return (
    <time dateTime={iso}>
      {new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(
        new Date(iso),
      )}
    </time>
  );
}
