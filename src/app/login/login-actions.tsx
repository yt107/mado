"use client";

import { CircleAlert, Copy, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";

import { isEmbeddedBrowser } from "@/lib/browser-support";

import { GoogleSignInButton } from "./google-sign-in-button";

const subscribeNothing = () => () => {};

// ログインの画面のボタンと、うまくいかないときの案内
export function LoginActions() {
  // Google のログインが失敗・中断して戻ってきたとき、Better Auth は ?error= を付ける
  const loginFailed = useSearchParams().has("error");
  // アプリの中のブラウザかどうかは、ブラウザでしか分からない（サーバーでは「使える」とする）
  const unsupported = useSyncExternalStore(
    subscribeNothing,
    () => isEmbeddedBrowser(navigator.userAgent),
    () => false,
  );

  return (
    <>
      {unsupported ? (
        <UnsupportedBrowserNotice />
      ) : (
        loginFailed && (
          <div
            role="alert"
            className="mt-8 flex gap-3 rounded-[10px] border border-danger/40 bg-danger/10 px-4 py-3.5"
          >
            <CircleAlert
              aria-hidden
              className="mt-0.5 size-4.5 shrink-0 text-danger"
            />
            <div>
              <p className="text-sm font-bold">
                Googleでのログインを完了できませんでした
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">
                ログイン画面が閉じられたか、通信が中断された可能性があります。もう一度「Google
                で続行」を押してください。
              </p>
            </div>
          </div>
        )
      )}
      <GoogleSignInButton
        className={unsupported || loginFailed ? "mt-6" : "mt-8"}
        disabled={unsupported}
      />
    </>
  );
}

// アプリの中のブラウザで開いたときの案内。URL をコピーして、Chrome や Safari で開いてもらう
function UnsupportedBrowserNotice() {
  const [copyMessage, setCopyMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copyUrl() {
    clearTimeout(timer.current);
    let message: string;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      message = "コピーしました";
    } catch {
      // アプリの中のブラウザでは、新しいコピーの方法が許されていないことがあるので、古い方法も試す
      message = legacyCopy(url) ? "コピーしました" : "コピーできませんでした";
    }
    setCopyMessage("");
    // 同じ文でも読み上げるように、いったん空にしてから入れる
    requestAnimationFrame(() => setCopyMessage(message));
    timer.current = setTimeout(() => setCopyMessage(""), 2000);
  }

  return (
    <div
      role="alert"
      className="mt-8 flex gap-3 rounded-[10px] border border-accent/50 bg-accent/10 px-4 py-3.5"
    >
      <TriangleAlert
        aria-hidden
        className="mt-0.5 size-4.5 shrink-0 text-accent-ink"
      />
      <div>
        <p className="text-sm font-bold">
          このブラウザではGoogleログインを利用できません
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          アプリ内ブラウザやキオスクアプリでは、Googleのログイン画面を開けないことがあります。ChromeやSafariで開いてください。
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={copyUrl}
            className="flex items-center gap-1.5 rounded text-xs font-bold text-accent-ink hover:underline"
          >
            <Copy aria-hidden className="size-3.5" />
            このページのURLをコピー
          </button>
          {/* コピーできたかを伝える。ボタンの外に置き、出たら読み上げる */}
          <span role="status" className="text-xs text-ink-2">
            {copyMessage}
          </span>
        </div>
      </div>
    </div>
  );
}

// 古いコピーの方法（document.execCommand）。新しい方法（Clipboard API）が使えないときだけ使う
function legacyCopy(text: string) {
  const field = Object.assign(document.createElement("textarea"), {
    value: text,
  });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
