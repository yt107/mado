import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    // テーブル名を複数形（users、sessions など）にする
    usePlural: true,
  }),
  // Google でログインする。値は .env.local（本番は Cloud Run）から読む
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // ID トークンを送ってログインする入り口は使わないので、閉じる
      disableIdTokenSignIn: true,
    },
  },
  account: {
    // Google のトークンを暗号化してから DB に保存する（初期設定では暗号化しない）
    encryptOAuthTokens: true,
  },
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
