"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        authClient.signOut({
          fetchOptions: {
            // ログアウトできたら、ログインの画面へ移す
            onSuccess: () => router.push("/login"),
          },
        })
      }
    >
      ログアウト
    </button>
  );
}
