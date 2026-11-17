import { GoogleSignInButton } from "./google-sign-in-button";

export default function LoginPage() {
  return (
    <main>
      <h1>ログイン</h1>
      <p>はじめての方も、Googleで続行するとそのまま登録できます。</p>
      <GoogleSignInButton />
    </main>
  );
}
