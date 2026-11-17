import { createAuthClient } from "better-auth/react";

// 画面から Better Auth（/api/auth/*）を呼ぶためのクライアント。
// 画面と API は同じドメインなので、baseURL は書かない
export const authClient = createAuthClient();
