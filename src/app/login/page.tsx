import { AuthShell } from "@/components/auth-shell";
import { HeroPreview } from "@/components/hero-preview";

import { GoogleSignInButton } from "./google-sign-in-button";

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
      <GoogleSignInButton className="mt-8" />
      <p className="mt-8 text-center text-xs leading-relaxed text-ink-3">
        初回ログイン時に、利用規約とプライバシーポリシーへの同意をお願いしています。
      </p>
    </AuthShell>
  );
}
