import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getMyBoard } from "@/lib/board/data";
import { verifySession } from "@/lib/session";

import { Editor } from "./editor";

export const metadata: Metadata = {
  title: "編集モード",
};

// 編集モード（ウィジェットを置く・動かす・外す、設定を変える）
export default function EditPage() {
  return (
    // ログイン状態とボードはリクエストごとに読むので、Suspense の中に置く
    <Suspense
      fallback={
        <p className="grid min-h-dvh place-items-center text-ink-3">
          読み込み中…
        </p>
      }
    >
      <Edit />
    </Suspense>
  );
}

async function Edit() {
  // ログインしていなければログインの画面へ、ボードがまだなければテンプレートの選択へ移す
  const user = await verifySession();
  const board = await getMyBoard(user.id);
  if (!board) {
    redirect("/setup");
  }
  return <Editor board={board} user={{ name: user.name, email: user.email }} />;
}
