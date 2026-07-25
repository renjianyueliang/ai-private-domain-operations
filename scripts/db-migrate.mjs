import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "db", "schema.sql");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const schema = await readFile(schemaPath, "utf8");
const checksum = createHash("sha256").update(schema).digest("hex");
const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await pool.query(schema);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_schema_migrations (
      id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
  await pool.query(
    `INSERT INTO app_schema_migrations (id, checksum, applied_at)
     VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE
       SET checksum = EXCLUDED.checksum,
           applied_at = EXCLUDED.applied_at`,
    ["db/schema.sql", checksum],
  );
  console.log(JSON.stringify({ migrated: true, checksum }, null, 2));
} finally {
  await pool.end();
}
