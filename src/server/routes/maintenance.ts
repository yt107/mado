import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

import { cleanUpStaleData } from "../services/maintenance";

const unauthorized = {
  error: { code: "unauthorized", message: "合言葉が正しくありません" },
};

// 定期実行（Cloud Scheduler）から呼ぶ API。ログインではなく、合言葉（CRON_SECRET）で確かめる。
// `Authorization: Bearer <CRON_SECRET>` で呼ぶ
const maintenance = new Hono().post(
  "/cleanup",
  async (c, next) => {
    // 合言葉を決めていない環境（開発など）では、この API はないものとする
    const token = process.env.CRON_SECRET;
    if (!token) {
      return c.json(
        { error: { code: "not_found", message: "見つかりません" } },
        404,
      );
    }
    // 合言葉は、かかる時間で中身が分からない方法で比べる（Hono の bearerAuth）
    return bearerAuth({
      token,
      noAuthenticationHeader: { message: unauthorized },
      invalidAuthenticationHeader: { message: unauthorized },
      invalidToken: { message: unauthorized },
    })(c, next);
  },
  // 要らなくなったデータを消して、消した件数を返す。
  // 毎日 DB を使うので、Supabase の無料プランの「1週間使わないと止まる」も防げる
  async (c) => c.json({ deleted: await cleanUpStaleData() }, 200),
);

export default maintenance;
