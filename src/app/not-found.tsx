import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PRIMARY_ACTION, StatusPage } from "@/components/status-page";

export const metadata: Metadata = {
  title: "ページが見つかりません",
};

// どの画面にも当てはまらない URL を開いたときの画面（404）
export default function NotFound() {
  return (
    <StatusPage
      icon={SearchX}
      title="ページが見つかりません"
      actions={
        <Link href="/" className={PRIMARY_ACTION}>
          トップへ戻る
        </Link>
      }
    >
      URL が間違っているか、ページが移動した可能性があります。
    </StatusPage>
  );
}
