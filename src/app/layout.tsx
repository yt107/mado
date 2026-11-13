import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mado",
  description:
    "好きなウィジェットを並べて、タブレットやサブディスプレイを情報ディスプレイにするWebアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
