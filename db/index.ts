import { db } from "../drizzle/db";
import * as schema from "./schema";

export * from "../drizzle/db";

export function getDb() {
  return db;
}

export { db, schema };
export default db;
