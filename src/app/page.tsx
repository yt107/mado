import { Suspense } from "react";

import { verifySession } from "@/lib/session";

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
  const user = await verifySession();
  return (
    <div>
      <p>
        {user.name}（{user.email}）でログイン中
      </p>
      <SignOutButton />
    </div>
  );
}
