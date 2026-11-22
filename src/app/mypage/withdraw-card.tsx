"use client";

import {
  CircleAlert,
  LayoutGrid,
  ShieldCheck,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useId, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { cx } from "@/lib/cx";
import { saveWithdrawIntent } from "@/lib/withdraw-intent";

type Props = {
  className?: string;
  user: { id: string; email: string };
  counts: { boards: number; widgets: number };
};

// 退会。確認のダイアログで同意したら、本人確認（Google での再ログイン）に進む。
// 戻ってきたら /mypage/withdraw で削除する
export function WithdrawCard({ className, user, counts }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 本人確認（Google での再ログイン）が失敗して戻ってきたとき、Better Auth は ?error= を付ける
  const reauthFailed = useSearchParams().has("error");

  function open() {
    setAgreed(false);
    setError(null);
    dialogRef.current?.showModal();
  }

  async function reauthenticate() {
    if (!agreed) {
      return;
    }
    setPending(true);
    setError(null);
    // 戻ってきたときに、同じアカウントで再ログインしたかを確かめるため、覚えておく
    if (!saveWithdrawIntent(user.id)) {
      setPending(false);
      setError(
        "ブラウザの設定で、手続きを続けられませんでした。別のブラウザでお試しください",
      );
      return;
    }
    const { error } = await authClient.signIn.social({
      provider: "google",
      // 本人確認ができたら、削除する画面へ
      callbackURL: "/mypage/withdraw",
      // キャンセルしたときなどは、マイページに戻る（?error= が付く）
      errorCallbackURL: "/mypage",
      // 今のアカウントを選んでおき、アカウントの選択画面を必ず出す
      loginHint: user.email,
      additionalParams: { prompt: "select_account" },
    });
    // うまくいけば Google の画面へ移る。失敗したときだけ、ここに来る
    if (error) {
      setPending(false);
      setError("本人確認を始められませんでした。もう一度お試しください");
    }
  }

  return (
    <section
      aria-labelledby="withdraw-title"
      className={cx(
        "rounded-2xl border border-danger/30 bg-card p-6",
        className,
      )}
    >
      <h2 id="withdraw-title" className="font-bold text-danger">
        退会
      </h2>
      {reauthFailed && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-[10px] bg-danger/10 px-3 py-2.5 text-sm text-danger"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          本人確認を完了できなかったため、退会していません。
        </p>
      )}
      {/* 狭い画面では、説明の下にボタンを置く */}
      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-sm leading-relaxed text-ink-2">
          アカウントと、すべてのダッシュボード・ウィジェット設定を削除します。この操作は取り消せません。
        </p>
        <button
          type="button"
          onClick={open}
          className="flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-danger/60 px-4 text-sm font-bold text-danger hover:bg-danger/10"
        >
          <UserX aria-hidden className="size-4" />
          退会する
        </button>
      </div>

      {/* 退会の確認。ブラウザの dialog を showModal() で開く（Esc で閉じる、裏の画面は操作できない） */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-130 rounded-2xl border border-line bg-card p-5 text-ink shadow-2xl backdrop:bg-black/60 sm:p-7"
      >
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-full bg-danger/15 text-danger"
        >
          <TriangleAlert className="size-6" />
        </span>
        <h2 id={titleId} className="mt-5 text-xl font-bold">
          本当に退会しますか？
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          退会すると、次のデータがすべて削除され、元に戻せません。
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-raised px-4 py-3.5 text-sm">
          <span className="flex items-center gap-2.5 whitespace-nowrap">
            <LayoutGrid aria-hidden className="size-4 text-ink-2" />
            ダッシュボード
          </span>
          <span className="text-right text-ink-2">
            {counts.boards}件（ウィジェット {counts.widgets}個）
          </span>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="size-4.5 shrink-0 accent-danger"
          />
          内容を確認し、データが削除されることに同意します
        </label>
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-3">
          <ShieldCheck aria-hidden className="size-4 shrink-0" />
          続行すると、本人確認のため Google での再ログインを求めます。
        </p>

        <p role="alert" className="mt-3 min-h-5 text-sm text-danger">
          {error}
        </p>

        {/* 狭い画面では、ボタンを縦に並べる（取り消せない操作を上、キャンセルを下） */}
        <form
          method="dialog"
          className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
        >
          {/* 取り消せない操作なので、最初は安全な「キャンセル」にフォーカスを置く */}
          <button
            type="submit"
            autoFocus
            className="h-11 rounded-[10px] border border-line px-5 text-sm font-bold whitespace-nowrap hover:bg-raised"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={reauthenticate}
            disabled={!agreed || pending}
            className="h-11 rounded-[10px] bg-danger px-5 text-sm font-bold whitespace-nowrap text-white hover:opacity-90 disabled:opacity-40"
          >
            本人確認して退会する
          </button>
        </form>
      </dialog>
    </section>
  );
}
