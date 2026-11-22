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

export default function LoginPage() {
  return (
    <AuthShell
      heroTitle="時計・天気・予定を、ひとつの画面に。"
      heroDescription={
        <>
          好きなウィジェットを並べて、タブレットやサブディスプレイを
          <br />
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
      <Suspense fallback={<GoogleSignInButton className="mt-8" />}>
        <LoginActions />
      </Suspense>
      <p className="mt-8 text-center text-xs leading-relaxed text-ink-3">
        初回ログイン時に、
        <Link
          href="/terms"
          className="underline underline-offset-4 hover:text-ink"
        >
          利用規約
        </Link>
        と
        <Link
          href="/privacy"
          className="underline underline-offset-4 hover:text-ink"
        >
          プライバシーポリシー
        </Link>
        への同意をお願いしています。
      </p>
    </AuthShell>
  );
}
