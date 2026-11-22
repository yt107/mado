import { and, isNull, lt } from "drizzle-orm";

import { db } from "../db";
import { sessions, users, verifications } from "../db/schema";

// 利用規約に同意しないまま残ったユーザーを消すまでの時間（24時間）
export const UNCONSENTED_USER_TTL_MS = 24 * 60 * 60 * 1000;

// 要らなくなったデータを消す（docs/er.md の「削除のルール」）。
// 毎日1回、Cloud Scheduler から POST /api/maintenance/cleanup で呼ぶ
export async function cleanUpStaleData(now = new Date()) {
  // 確認画面でタブを閉じるなどして、24時間たっても同意していないユーザー。
  // accounts と sessions も一緒に消える（ON DELETE CASCADE）。同意していないので、ボードはない
  const deletedUsers = await db
    .delete(users)
    .where(
      and(
        isNull(users.termsAcceptedAt),
        lt(users.createdAt, new Date(now.getTime() - UNCONSENTED_USER_TTL_MS)),
      ),
    )
    .returning({ id: users.id });

  // 期限が切れたセッション（Better Auth は、切れたものを読んだときにしか消さない）
  const deletedSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });

  // 期限が切れた、Google ログインの途中の一時的な値（state など）
  const deletedVerifications = await db
    .delete(verifications)
    .where(lt(verifications.expiresAt, now))
    .returning({ id: verifications.id });

  return {
    users: deletedUsers.length,
    sessions: deletedSessions.length,
    verifications: deletedVerifications.length,
  };
}
