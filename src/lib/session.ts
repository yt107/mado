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
  const { id, name, email, termsAcceptedAt } = session.user;
  return { id, name, email, termsAcceptedAt: termsAcceptedAt ?? null };
});

// 利用規約に同意したユーザーを返す。同意していなければ、確認画面へ移す。
// ダッシュボードなど、同意してから使う画面は、こちらを使う
export const verifyConsentedUser = cache(async () => {
  const user = await verifySession();
  if (!user.termsAcceptedAt) {
    redirect("/welcome");
  }
  return user;
});
