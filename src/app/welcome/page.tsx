import { redirect } from "next/navigation";
import { Suspense } from "react";

import { verifySession } from "@/lib/session";

import { ConsentForm } from "./consent-form";

// 初回ログインの確認画面。ユーザー名を決めて、利用規約に同意してもらう
export default function WelcomePage() {
  return (
    <main>
      <h1>はじめる前に確認してください</h1>
      <p>Googleアカウントでの登録が完了しました。あと1ステップです。</p>
      {/* ログイン状態はリクエストごとに読むので、Suspense の中に置く */}
      <Suspense fallback={<p>読み込み中…</p>}>
        <Consent />
      </Suspense>
    </main>
  );
}

async function Consent() {
  const user = await verifySession();
  // 同意済みなら、確認することはないので、トップへ移す
  if (user.termsAcceptedAt) {
    redirect("/");
  }
  return (
    <>
      <p>
        {user.email}
        <br />
        Googleアカウントでログイン中
      </p>
      <ConsentForm defaultName={user.name} />
    </>
  );
}
