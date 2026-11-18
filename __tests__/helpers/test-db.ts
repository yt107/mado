import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/server/db/schema";

// テスト用の DB を、メモリの中に作る（PGlite）。本物のマイグレーションを当てるので、テーブルは本番と同じ
export async function createTestDb() {
  const client = new PGlite();
  // 0001 のマイグレーションは、Supabase にあるロールを使う。PGlite にはないので、先に作る
  await client.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;",
  );
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}
