import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";

loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import("../src/db/client");
  const result = await db.execute(sql`
    select
      current_database() as database_name,
      current_user as user_name
  `);

  console.log(result.rows[0]);
  await db.$client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
