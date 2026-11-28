import type { Metadata } from "next";
import { Suspense } from "react";

import { verifySession } from "@/lib/session";

import { WithdrawRunner } from "./withdraw-runner";

export const metadata: Metadata = {
  title: "退会の手続き",
};

// 本人確認（Google での再ログイン）から戻ってきたら、ここで退会（削除）する
export default function WithdrawPage() {
  return (
    <Suspense
      fallback={<div className="min-h-dvh bg-surface" aria-busy="true" />}
    >
      <Withdraw />
    </Suspense>
  );
}

async function Withdraw() {
  const user = await verifySession();
  return <WithdrawRunner userId={user.id} email={user.email} />;
}
