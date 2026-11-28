import { lt } from "drizzle-orm";

import { db } from "../db";
import { sessions, verifications } from "../db/schema";

// 要らなくなったデータを消す（docs/er.md の「削除のルール」）。
// 毎日1回、Cloud Scheduler から POST /api/maintenance/cleanup で呼ぶ
export async function cleanUpStaleData(now = new Date()) {
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
    sessions: deletedSessions.length,
    verifications: deletedVerifications.length,
  };
}
