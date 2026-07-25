import { Pool, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as {
  aiSaasPool?: Pool;
  aiSaasSchemaReady?: Promise<void>;
};

export function getStorageMode() {
  return process.env.DATABASE_URL?.trim() ? "postgres" : "local";
}

export function isPostgresConfigured() {
  return getStorageMode() === "postgres";
}

function getPool() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!globalForPg.aiSaasPool) {
    globalForPg.aiSaasPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalForPg.aiSaasPool;
}

export async function ensureRuntimeSchema() {
  if (!isPostgresConfigured()) return;

  globalForPg.aiSaasSchemaReady ??= getPool().query(`
    CREATE TABLE IF NOT EXISTS app_uploads (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('knowledge', 'video')),
      original_name text NOT NULL,
      stored_name text NOT NULL,
      relative_path text NOT NULL,
      mime_type text NOT NULL,
      size_bytes bigint NOT NULL,
      status text NOT NULL,
      uploaded_by text NOT NULL,
      created_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_queue_jobs (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_id text,
      kind text NOT NULL,
      title text NOT NULL,
      status text NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      created_by text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      logs jsonb NOT NULL DEFAULT '[]'::jsonb
    );

    CREATE TABLE IF NOT EXISTS app_audit_logs (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      actor text NOT NULL,
      action text NOT NULL,
      target_id text,
      created_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_tenant_drafts (
      id text PRIMARY KEY,
      company text NOT NULL,
      industry text NOT NULL,
      plan text NOT NULL,
      renewal_date date NOT NULL,
      seats integer NOT NULL,
      status text NOT NULL,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_model_usage_events (
      id text PRIMARY KEY,
      tenant_id text,
      provider text NOT NULL,
      model text NOT NULL,
      ok boolean NOT NULL,
      fallback_used boolean NOT NULL,
      latency_ms integer NOT NULL,
      task_kind text,
      error text,
      created_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_connector_connections (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      connector_id text NOT NULL,
      status text NOT NULL,
      credential_ref text,
      scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      UNIQUE (tenant_id, connector_id)
    );

    CREATE TABLE IF NOT EXISTS app_billing_records (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('contract', 'invoice', 'payment')),
      title text NOT NULL,
      amount_cny numeric NOT NULL DEFAULT 0,
      status text NOT NULL,
      due_date date,
      note text,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_app_uploads_tenant_created
      ON app_uploads(tenant_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_app_jobs_tenant_status
      ON app_queue_jobs(tenant_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_app_audit_tenant_created
      ON app_audit_logs(tenant_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_app_tenant_drafts_created
      ON app_tenant_drafts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_app_model_usage_tenant_created
      ON app_model_usage_events(tenant_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_app_connectors_tenant_status
      ON app_connector_connections(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_app_billing_tenant_created
      ON app_billing_records(tenant_id, created_at DESC);
  `).then(() => undefined);

  await globalForPg.aiSaasSchemaReady;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
) {
  await ensureRuntimeSchema();
  return getPool().query<T>(sql, params);
}
