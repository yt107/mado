import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    // テーブル名を複数形（users、sessions など）にする
    usePlural: true,
  }),
  user: {
    additionalFields: {
      // 利用規約に同意した日時。NULL なら確認画面へ進ませる（er.md）
      termsAcceptedAt: {
        type: "date",
        required: false,
        // ログインの仕組みからは書き込めないようにする。同意の API からだけ書き込む
        input: false,
      },
    },
  },
});
