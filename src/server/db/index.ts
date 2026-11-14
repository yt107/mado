import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { supabaseCa } from "./supabase-ca";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, {
  // Session pooler は同時につなげる数に上限がある。Cloud Run は最大2台なので、1台あたり5本まで
  max: 5,
  // 使っていない接続は20秒で閉じて、プールの枠を空ける
  idle_timeout: 20,
  // Supabase の証明書で、つないだ相手が本物の Supabase かを確かめる（verify-full）
  ssl: { ca: supabaseCa },
});

export const db = drizzle({ client, schema });
