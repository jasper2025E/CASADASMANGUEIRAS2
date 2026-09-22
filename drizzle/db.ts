import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Cache connection in development to avoid exhausting connection pools across HMR
declare global {
  var __drizzle_client: postgres.Sql | undefined;
  var __drizzle_db: PostgresJsDatabase<typeof schema> | undefined;
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "postgres://postgres:postgres@localhost:5432/postgres";

const isProduction = process.env.NODE_ENV === "production";

function createClient(): postgres.Sql {
  return postgres(connectionString, {
    // Supabase transaction pooler (port 6543) and serverless environments require prepare: false
    prepare: false,
    max: isProduction ? 10 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const client = global.__drizzle_client || createClient();
if (!isProduction) {
  global.__drizzle_client = client;
}

export const db: PostgresJsDatabase<typeof schema> =
  global.__drizzle_db || drizzle(client, { schema });

if (!isProduction) {
  global.__drizzle_db = db;
}

export { client, schema };
export default db;
