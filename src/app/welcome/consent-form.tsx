"use client";

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
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">ユーザー名</label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={defaultName}
            required
            maxLength={50}
            autoComplete="nickname"
            aria-describedby="name-hint"
          />
          <p id="name-hint">
            Googleの表示名を入れています。あとから変更できます
          </p>
        </div>

        <section aria-labelledby="google-info">
          <h2 id="google-info">Googleから受け取る情報</h2>
          <ul>
            <li>名前・メールアドレス・プロフィール画像</li>
            <li>カレンダーなどの情報は、連携を許可するまで取得しません</li>
          </ul>
        </section>

        <div>
          <input
            id="agreeToTerms"
            name="agreeToTerms"
            type="checkbox"
            required
          />
          <label htmlFor="agreeToTerms">
            利用規約とプライバシーポリシーに同意します（必須）
          </label>
        </div>

        {/* うまくいかなかったときのメッセージ。出たら、読み上げる */}
        <p role="alert">{error}</p>

        <button type="submit" disabled={isPending}>
          同意してはじめる
        </button>
      </form>

      <button type="button" onClick={handleCancel} disabled={isPending}>
        キャンセルしてログアウト
      </button>
    </>
  );
}
