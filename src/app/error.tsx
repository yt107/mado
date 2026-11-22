"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import {
  PRIMARY_ACTION,
  SECONDARY_ACTION,
  StatusPage,
} from "@/components/status-page";

// 思いがけないエラーが起きたときの画面。ルートのレイアウトの中に出る
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // サーバーで起きたエラーには、サーバーのログと照らし合わせるための番号が付いている
  const digest =
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <StatusPage
      icon={TriangleAlert}
      tone="danger"
      title="問題が発生しました"
      actions={
        <>
          <button type="button" onClick={retry} className={PRIMARY_ACTION}>
            もう一度試す
          </button>
          <Link href="/" className={SECONDARY_ACTION}>
            トップへ戻る
          </Link>
        </>
      }
    >
      <p>時間をおいて、もう一度お試しください。</p>
      {digest && (
        <p className="mt-2 text-xs text-ink-3">エラー番号：{digest}</p>
      )}
    </StatusPage>
  );
}
