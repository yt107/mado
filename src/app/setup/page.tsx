import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { hasBoard } from "@/lib/board/data";
import { verifyConsentedUser } from "@/lib/session";

import { TemplatePicker } from "./template-picker";

export const metadata: Metadata = {
  title: "テンプレートを選ぶ",
};

// 初回の設定（テンプレートの選択）
export default function SetupPage() {
  return (
    // ログイン状態はリクエストごとに読むので、Suspense の中に置く
    <Suspense
      fallback={
        <p className="grid min-h-dvh place-items-center text-ink-3">
          読み込み中…
        </p>
      }
    >
      <Setup />
    </Suspense>
  );
}

async function Setup() {
  // 同意していなければ確認画面へ、ボードがもうあれば表示モードへ移す
  const user = await verifyConsentedUser();
  if (await hasBoard(user.id)) {
    redirect("/");
  }
  return <TemplatePicker />;
}
