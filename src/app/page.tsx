import { Suspense } from "react";

import { verifyConsentedUser } from "@/lib/session";

import { SignOutButton } from "./sign-out-button";

export default function Home() {
  return (
    <main>
      {/* ログイン状態はリクエストごとに読むので、Suspense の中に置く */}
      <Suspense fallback={<p>読み込み中…</p>}>
        <CurrentUser />
      </Suspense>
    </main>
  );
}

async function CurrentUser() {
  // 同意していなければ、確認画面へ移す
  const user = await verifyConsentedUser();
  return (
    <div>
      <p>
        {user.name}（{user.email}）でログイン中
      </p>
      <SignOutButton />
    </div>
  );
}
