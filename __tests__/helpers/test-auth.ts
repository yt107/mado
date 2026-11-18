import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";

import { auth } from "@/server/auth";

// テストのときだけ使う Better Auth。本物と同じ設定に、テスト用の機能（testUtils）を足す。
// testUtils はセッションを自由に作れるので、本物の設定には入れない（Better Auth の案内どおり）
const testAuth = betterAuth({ ...auth.options, plugins: [testUtils()] });

// ログインした状態のヘッダー（Cookie）を作る。DB に本物のセッションができる
export async function loginAs(userId: string) {
  const ctx = await testAuth.$context;
  return ctx.test.getAuthHeaders({ userId });
}
