import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PRIMARY_ACTION, StatusPage } from "@/components/status-page";

export const metadata: Metadata = {
  title: "退会しました",
};

// 退会が終わったあとの画面
export default function GoodbyePage() {
  return (
    <StatusPage
      icon={CircleCheck}
      tone="success"
      title="退会しました"
      actions={
        <Link href="/login" className={PRIMARY_ACTION}>
          ログイン画面へ
        </Link>
      }
    >
      アカウントと、すべてのデータを削除しました。
      <br />
      ご利用ありがとうございました。
    </StatusPage>
  );
}
