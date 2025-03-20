import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import * as pg from "pg";
import type { DB } from "./db.d.ts";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}

// Map int8 to number. This applies during runtime and does not affect the typescript types
const int8TypeId = 20;
pg.types.setTypeParser(int8TypeId, (val: string) => {
  return Number.parseInt(val, 10);
});

const dbClient = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: DATABASE_URL,
    }),
  }),
  plugins: [new CamelCasePlugin()],
});

export default dbClient;
