import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getMyBoard } from "@/lib/board/data";
import { verifyConsentedUser } from "@/lib/session";

import { DisplayMode } from "./display-mode";

// トップは表示モード（ボードを画面いっぱいに出す）
export default function Home() {
  return (
    // ログイン状態とボードはリクエストごとに読むので、Suspense の中に置く
    <Suspense fallback={<div className="h-dvh bg-canvas" />}>
      <Display />
    </Suspense>
  );
}

async function Display() {
  // 同意していなければ確認画面へ、ボードがまだなければテンプレートの選択へ移す
  const user = await verifyConsentedUser();
  const board = await getMyBoard(user.id);
  if (!board) {
    redirect("/setup");
  }
  return <DisplayMode board={board} />;
}
