"use client";

import { authClient } from "@/lib/auth-client";

export function GoogleSignInButton() {
  return (
    <button
      type="button"
      onClick={() =>
        authClient.signIn.social({
          provider: "google",
          // ログインできたら、トップに戻る
          callbackURL: "/",
          // Google でキャンセルしたときなどは、ログインの画面に戻る
          errorCallbackURL: "/login",
        })
      }
    >
      Google で続行
    </button>
  );
}
