import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth-shell";
import { HeroPreview } from "@/components/hero-preview";

import { GoogleSignInButton } from "./google-sign-in-button";
import { LoginActions } from "./login-actions";

export const metadata: Metadata = {
  title: "ログイン",
};

const TERMS_NOTICE_ID = "terms-notice";

export default function LoginPage() {
  return (
    <AuthShell
      heroTitle="時計・天気・予定を、ひとつの画面に。"
      heroDescription={
        <>
          好きなウィジェットを並べて、タブレットやサブディスプレイを
          {/* 狭い画面では、決めた位置で改行せず、文節で自然に折り返す */}
          <br className="hidden xl:inline" />
          あなた専用の情報ディスプレイに。
        </>
      }
      hero={<HeroPreview showTargetPicker />}
    >
      <h1 className="text-3xl font-bold">ログイン</h1>
      <p className="mt-3 text-sm text-ink-2">
        はじめての方も、Googleで続行するとそのまま登録できます。
      </p>
      {/* URL の ?error= を読むので、Suspense の中に置く。読む前は、ボタンだけを出す */}
      <Suspense
        fallback={
          <GoogleSignInButton className="mt-8" describedBy={TERMS_NOTICE_ID} />
        }
      >
        <LoginActions describedBy={TERMS_NOTICE_ID} />
      </Suspense>
      {/* ボタンのすぐ下に置き、ボタンの説明として読み上げる（aria-describedby）。
          押すと同意したとみなすことを、押す前に見せる（民法548条の2の「表示」） */}
      <p
        id={TERMS_NOTICE_ID}
        className="mt-4 text-center text-xs leading-relaxed text-balance text-ink-3"
      >
        続行すると、
        <Link
          href="/terms"
          className="underline underline-offset-4 hover:text-ink"
        >
          利用規約
        </Link>
        に同意し、
        <Link
          href="/privacy"
          className="underline underline-offset-4 hover:text-ink"
        >
          プライバシーポリシー
        </Link>
        を確認したものとみなします。
      </p>
    </AuthShell>
  );
}
