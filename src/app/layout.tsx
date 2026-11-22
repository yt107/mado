import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";

import "./globals.css";

// フォントは、ビルドのときに取り込んで、このサイトから配る（ブラウザは Google に問い合わせない）
const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  // ページごとのタイトルは「マイページ - Mado」の形にする。決めていないページは「Mado」
  title: { default: "Mado", template: "%s - Mado" },
  description:
    "好きなウィジェットを並べて、タブレットやサブディスプレイを情報ディスプレイにするWebアプリ",
};

export const viewport: Viewport = {
  // ライトとダークの両方に対応していることを、最初にブラウザへ伝える
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} ${inter.variable}`}>
      <body className="bg-canvas font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
