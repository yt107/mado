import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/server/auth";

// ログイン中のユーザーを返す。ログインしていなければ、ログインの画面へ移す。
// cache で、1回の表示のあいだに何度呼んでも、確かめるのは1回だけにする
export const verifySession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
    // ここ（Server Components）では、ログインの期限を延ばさない。
    // 延ばしても Cookie を送り直せないので、DB の期限だけが延びて、Cookie が先に切れてしまうため。
    // 期限は、画面から /api/auth/get-session を呼んだときに、DB と Cookie を一緒に延ばす
    query: { disableRefresh: true },
  });
  if (!session) {
    redirect("/login");
  }
  // 画面に渡すのは、使う値だけにする
  const { id, name, email, createdAt } = session.user;
  return { id, name, email, createdAt };
});
