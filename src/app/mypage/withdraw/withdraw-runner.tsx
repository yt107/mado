"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PRIMARY_ACTION, StatusPage } from "@/components/status-page";
import { api } from "@/lib/api-client";
import { takeWithdrawIntent } from "@/lib/withdraw-intent";

type Status =
  | { kind: "running" }
  | { kind: "no-intent" }
  | { kind: "other-account" }
  | { kind: "too-late" }
  | { kind: "failed" };

type Props = { userId: string; email: string };

type Result = Exclude<Status["kind"], "running"> | "deleted" | "signed-out";

// 保存しておいた手続きを確かめてから、削除する
async function withdraw(userId: string): Promise<Result> {
  const intent = takeWithdrawIntent();
  if (!intent) {
    return "no-intent";
  }
  // 再ログインで別の Google アカウントを選んだときは、そのアカウントを消さない
  if (intent.userId !== userId) {
    return "other-account";
  }
  try {
    const res = await api.me.$delete();
    if (res.ok) {
      return "deleted";
    }
    if ((res.status as number) === 401) {
      return "signed-out";
    }
    // 403 は、再ログインから10分以上たっていた
    return res.status === 403 ? "too-late" : "failed";
  } catch {
    return "failed";
  }
}

// 退会の手続きの続き。マイページで始めた手続きで、同じアカウントで再ログインしていれば削除する
export function WithdrawRunner({ userId, email }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "running" });
  // 開発中の Strict Mode では effect が2回動くので、1回だけ実行する
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    void withdraw(userId).then((result) => {
      if (result === "deleted") {
        router.replace("/goodbye");
      } else if (result === "signed-out") {
        router.replace("/login");
      } else {
        setStatus({ kind: result });
      }
    });
  }, [router, userId]);

  if (status.kind === "running") {
    return (
      <StatusPage icon={LoaderCircle} spin title="退会の手続きをしています">
        <p role="status">このままお待ちください。</p>
      </StatusPage>
    );
  }

  const backToMyPage = (
    <Link href="/mypage" className={PRIMARY_ACTION}>
      マイページへ戻る
    </Link>
  );

  return (
    <StatusPage
      icon={CircleAlert}
      tone="danger"
      title="退会していません"
      actions={backToMyPage}
    >
      <p role="alert">{MESSAGES[status.kind](email)}</p>
    </StatusPage>
  );
}

const MESSAGES: Record<
  Exclude<Status["kind"], "running">,
  (email: string) => string
> = {
  "no-intent": () =>
    "退会の手続きが見つかりませんでした。マイページから、もう一度やり直してください。",
  "other-account": (email) =>
    `退会を始めたときとは別のアカウント（${email}）でログインしました。このアカウントは削除していません。`,
  "too-late": () =>
    "本人確認から時間がたったため、退会できませんでした。マイページから、もう一度やり直してください。",
  failed: () =>
    "退会できませんでした。時間をおいて、マイページからもう一度お試しください。",
};
