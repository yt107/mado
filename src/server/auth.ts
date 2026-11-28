import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "./db";

// ログインの期限（30日）
export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;

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
  session: {
    // ログインの期限は30日（標準は7日）。表示用の端末を1〜2週間つけなくても、
    // ログインし直さずに済むようにする。使っているあいだは、1日ごとに30日先まで延びる。
    // 延ばすのは /api/auth/get-session を呼んだときだけ（src/lib/hooks/use-session-keep-alive.ts）
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
  },
  user: {
    additionalFields: {
      // 利用規約に同意した日時。登録のときに入れる（下の databaseHooks。er.md）
      termsAcceptedAt: {
        type: "date",
        required: false,
        // ログインの画面などから送られた値では、書き込めないようにする
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // ログインの画面には「続行すると、利用規約に同意し、…とみなします」と書いてある。
        // それを見て「Google で続行」を押して登録したので、登録した日時を、同意した日時にする
        before: async (user) => ({
          data: { ...user, termsAcceptedAt: new Date() },
        }),
      },
    },
  },
});
