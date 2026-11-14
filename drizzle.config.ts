import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { supabaseCa } from "./src/server/db/supabase-ca";

// drizzle-kit は Next.js の外で動くので、.env.local を自分で読み込む
loadEnvConfig(process.cwd());

// drizzle-kit は url で渡すと証明書を受け取れないので、接続の文字列を分けて渡す
const url = new URL(process.env.DATABASE_URL!);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { ca: supabaseCa },
  },
});
