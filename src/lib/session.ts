import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/server/auth";

// ログイン中のユーザーを返す。ログインしていなければ、ログインの画面へ移す。
// cache で、1回の表示のあいだに何度呼んでも、確かめるのは1回だけにする
export const verifySession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  // 画面に渡すのは、使う値だけにする
  const { id, name, email } = session.user;
  return { id, name, email };
});
