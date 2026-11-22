"use client";

import { CircleCheck, Info, ShieldCheck, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { api } from "@/lib/api-client";

const UNEXPECTED_ERROR =
  "うまくいきませんでした。時間をおいて、もう一度お試しください";

type Props = {
  // ユーザー名の欄に、最初から入れておく名前（Google の表示名）
  defaultName: string;
};

export function ConsentForm({ defaultName }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // 送っているあいだは、ボタンを押せないようにする（2回送らないため）
  const [isPending, startTransition] = useTransition();

  // 同意して、はじめる
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    if (formData.get("agreeToTerms") !== "on") {
      setError("利用規約に同意してください");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await api.me.consent.$post({
        json: { name, agreeToTerms: true },
      });
      // ログインが切れていたら、ログインの画面へ。
      // 401 はミドルウェアが返すので、API の型には出てこない。数として比べる
      if ((res.status as number) === 401) {
        router.push("/login");
        return;
      }
      // 同意できた（または、もう同意していた）なら、トップへ
      if (res.ok || res.status === 409) {
        router.push("/");
        return;
      }
      // 入力が正しくなければ、API のメッセージを出す
      if (res.status === 400) {
        const body = await res.json();
        setError(body.error.message);
        return;
      }
      setError(UNEXPECTED_ERROR);
    });
  }

  // キャンセルする。まだ同意していないので、アカウントをすぐに削除して、ログインの画面へ
  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const res = await api.me.$delete();
      // 削除できた、またはログインが切れていた（401）なら、ログインの画面へ
      if (res.ok || (res.status as number) === 401) {
        router.push("/login");
        return;
      }
      setError(UNEXPECTED_ERROR);
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col">
        <label htmlFor="name" className="text-sm text-ink-2">
          ユーザー名
        </label>
        <div className="relative mt-2">
          <User
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-3"
          />
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={defaultName}
            required
            maxLength={50}
            autoComplete="nickname"
            aria-describedby="name-hint"
            className="h-12 w-full rounded-[10px] border border-line bg-card pr-4 pl-11 text-ink"
          />
        </div>
        <p
          id="name-hint"
          className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"
        >
          <Info aria-hidden className="size-3.5 shrink-0" />
          Googleの表示名を入れています。あとから変更できます
        </p>

        <section
          aria-labelledby="google-info"
          className="mt-6 rounded-[10px] bg-raised px-4 py-3.5"
        >
          <h2
            id="google-info"
            className="text-[0.8125rem] font-bold text-ink-2"
          >
            Googleから受け取る情報
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs text-ink-2">
            <li className="flex items-center gap-2">
              <CircleCheck aria-hidden className="size-3.5 shrink-0" />
              名前・メールアドレス・プロフィール画像
            </li>
            <li className="flex items-center gap-2 text-ink-3">
              <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
              カレンダーなどの情報は、連携を許可するまで取得しません
            </li>
          </ul>
        </section>

        <div className="mt-6 flex items-center gap-2.5">
          <input
            id="agreeToTerms"
            name="agreeToTerms"
            type="checkbox"
            required
            className="size-4.5 shrink-0"
          />
          <label htmlFor="agreeToTerms" className="text-sm text-ink-2">
            {/* 入力を消さないように、規約は新しいタブで開く */}
            <a
              href="/terms"
              target="_blank"
              rel="noopener"
              className="text-ink underline underline-offset-4"
            >
              利用規約
            </a>
            と
            <a
              href="/privacy"
              target="_blank"
              rel="noopener"
              className="text-ink underline underline-offset-4"
            >
              プライバシーポリシー
            </a>
            に同意します（必須）
          </label>
        </div>

        {/* うまくいかなかったときのメッセージ。出たら、読み上げる */}
        <p role="alert" className="mt-3 min-h-5 text-sm text-danger">
          {error}
        </p>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 h-12 rounded-[10px] bg-accent font-bold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          同意してはじめる
        </button>
      </form>

      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="mx-auto mt-4 block rounded px-2 py-1 text-sm text-ink-2 hover:text-ink disabled:opacity-60"
      >
        キャンセルしてログアウト
      </button>
    </>
  );
}
