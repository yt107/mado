"use client";

import "./globals.css";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { PRIMARY_ACTION, StatusPage } from "@/components/status-page";

// ルートのレイアウトそのものでエラーが起きたときの画面。
// レイアウトの代わりに出るので、<html> と <body>、スタイルも自分で持つ（フォントは端末のものを使う）
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ja">
      <body className="bg-canvas text-ink antialiased">
        <title>問題が発生しました - Mado</title>
        <StatusPage
          icon={TriangleAlert}
          tone="danger"
          title="問題が発生しました"
          actions={
            <button type="button" onClick={retry} className={PRIMARY_ACTION}>
              もう一度試す
            </button>
          }
        >
          時間をおいて、もう一度お試しください。
        </StatusPage>
      </body>
    </html>
  );
}
