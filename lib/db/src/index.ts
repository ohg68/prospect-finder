import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn("DATABASE_URL is not provided! Database queries will fail.");
}

export const pool = new Pool({ connectionString: dbUrl || "" });
export const db = drizzle(pool, { schema });

export * from "drizzle-orm";
export * from "./schema/index.js";
