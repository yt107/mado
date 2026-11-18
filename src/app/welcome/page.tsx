import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth-shell";
import { HeroPreview } from "@/components/hero-preview";
import { StepIndicator } from "@/components/step-indicator";
import { verifySession } from "@/lib/session";

import { ConsentForm } from "./consent-form";

// 初回ログインの確認画面。ユーザー名を決めて、利用規約に同意してもらう
export default function WelcomePage() {
  return (
    <AuthShell
      heroTitle="テンプレートを選ぶだけで、すぐに使えます。"
      heroDescription={
        <>
          登録が終わったら、時計・天気・カレンダーなどが並んだ
          <br />
          テンプレートからダッシュボードを作れます。
        </>
      }
      hero={
        <>
          <HeroPreview />
          <StepIndicator current={2} />
        </>
      }
    >
      <h1 className="text-3xl font-bold">はじめる前に確認してください</h1>
      <p className="mt-3 text-sm text-ink-2">
        Googleアカウントでの登録が完了しました。あと1ステップです。
      </p>
      {/* ログイン状態はリクエストごとに読むので、Suspense の中に置く */}
      <Suspense fallback={<p className="mt-8 text-ink-3">読み込み中…</p>}>
        <Consent />
      </Suspense>
    </AuthShell>
  );
}

async function Consent() {
  const user = await verifySession();
  // 同意済みなら、確認することはないので、トップへ移す
  if (user.termsAcceptedAt) {
    redirect("/");
  }
  return (
    <>
      <div className="mt-8 flex items-center gap-3 rounded-[10px] border border-line bg-card px-4 py-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-avatar font-bold text-white"
        >
          {user.email.charAt(0).toUpperCase()}
        </span>
        <p className="min-w-0">
          <span className="block truncate text-sm">{user.email}</span>
          <span className="block text-xs text-ink-3">
            Googleアカウントでログイン中
          </span>
        </p>
      </div>
      <ConsentForm defaultName={user.name} />
    </>
  );
}
