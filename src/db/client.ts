import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const globalForDatabase = globalThis as typeof globalThis & {
  postgresPool?: Pool;
};

const pool =
  globalForDatabase.postgresPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.postgresPool = pool;
}

export const db = drizzle(pool, { schema });
