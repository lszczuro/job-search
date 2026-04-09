import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { parseEnv } from "../config/env";
import * as schema from "./schema";

export function createDb(env = process.env) {
  const config = parseEnv(env);
  const sqlite = new Database(config.databasePath);

  return drizzle(sqlite, { schema });
}
