-- AI 私域 SaaS 指挥官 PostgreSQL 表结构草案
-- 目标：多租户、登录权限、知识库、视频资产、任务队列、发布任务、私域会话、审计日志。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('platform_admin', 'tenant_admin', 'operator', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE upload_kind AS ENUM ('knowledge', 'video');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE upload_status AS ENUM ('uploaded', 'queued', 'processed', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE job_status AS ENUM ('queued', 'running', 'needs_review', 'done', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE job_kind AS ENUM (
    'knowledge_ingest',
    'video_transcode',
    'subtitle_generation',
    'compliance_review',
    'publish_video',
    'sync_comments',
    'private_domain_reply'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE publish_mode AS ENUM ('official_api', 'semi_auto', 'asset_pack', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE conversation_intent AS ENUM ('low', 'medium', 'high', 'human_required');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'expired', 'paused', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE autopilot_mode AS ENUM ('assist', 'review', 'guarded', 'managed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE exception_status AS ENUM ('open', 'acknowledged', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE opportunity_stage AS ENUM ('new', 'qualified', 'proposal', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'paid', 'delivered', 'refunded', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  annual_price_cny numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  recommended_for text NOT NULL,
  seats_limit integer NOT NULL,
  contacts_limit integer NOT NULL,
  ai_runs_limit integer NOT NULL,
  video_jobs_limit integer NOT NULL,
  storage_limit_mb integer NOT NULL,
  industry_limit integer,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_features (
  plan_code text NOT NULL REFERENCES plans(code) ON DELETE CASCADE,
  feature_key text NOT NULL,
  feature_label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_code, feature_key)
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  owner_name text NOT NULL,
  industry_template_id uuid,
  status tenant_status NOT NULL DEFAULT 'trial',
  plan_name text NOT NULL DEFAULT '试用版',
  plan_code text REFERENCES plans(code),
  renewal_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_tenant_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS industry_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  risk_level text NOT NULL,
  description text NOT NULL,
  allowed_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  prohibited_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_disclaimers jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE tenants
    ADD CONSTRAINT tenants_industry_template_fk
    FOREIGN KEY (industry_template_id) REFERENCES industry_templates(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES users(id),
  title text NOT NULL,
  file_name text NOT NULL,
  storage_key text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  status upload_status NOT NULL DEFAULT 'queued',
  extracted_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES users(id),
  title text NOT NULL,
  file_name text NOT NULL,
  source_storage_key text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  duration_seconds integer,
  status upload_status NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id),
  kind job_kind NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  upload_kind upload_kind,
  knowledge_document_id uuid REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  video_asset_id uuid REFERENCES video_assets(id) ON DELETE SET NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status job_status NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id),
  title text NOT NULL,
  platform_goal text NOT NULL,
  format text NOT NULL,
  source_document_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  body text NOT NULL,
  status job_status NOT NULL DEFAULT 'needs_review',
  risk_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publish_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform text NOT NULL,
  mode publish_mode NOT NULL,
  status text NOT NULL,
  external_account_name text,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform)
);

CREATE TABLE IF NOT EXISTS publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES publish_connections(id) ON DELETE SET NULL,
  video_asset_id uuid REFERENCES video_assets(id) ON DELETE SET NULL,
  content_brief_id uuid REFERENCES content_briefs(id) ON DELETE SET NULL,
  platform text NOT NULL,
  mode publish_mode NOT NULL,
  status job_status NOT NULL DEFAULT 'needs_review',
  scheduled_at timestamptz,
  published_at timestamptz,
  platform_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_thread_id text,
  visitor_name text NOT NULL,
  intent conversation_intent NOT NULL DEFAULT 'medium',
  question text NOT NULL,
  ai_reply_suggestion text NOT NULL,
  next_step text NOT NULL,
  assigned_to uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id),
  command text NOT NULL,
  execution_mode text NOT NULL,
  model text NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  title text NOT NULL,
  objective text NOT NULL,
  input text NOT NULL,
  output text,
  status job_status NOT NULL DEFAULT 'queued',
  compliance_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES plans(code),
  plan_name text NOT NULL,
  status subscription_status NOT NULL DEFAULT 'trial',
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  expires_at date,
  seats_limit integer NOT NULL,
  contacts_limit integer NOT NULL,
  ai_runs_limit integer NOT NULL,
  video_jobs_limit integer NOT NULL,
  storage_limit_mb integer NOT NULL,
  billing_note text,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL,
  reason text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_key)
);

CREATE TABLE IF NOT EXISTS usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Revenue autopilot contracts. These records let the product optimize against
-- qualified leads, orders and attributable revenue instead of vanity metrics.
CREATE TABLE IF NOT EXISTS revenue_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_revenue_cny numeric NOT NULL DEFAULT 0,
  target_qualified_leads integer NOT NULL DEFAULT 0,
  target_paid_orders integer NOT NULL DEFAULT 0,
  gross_margin_rate numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  mode autopilot_mode NOT NULL DEFAULT 'review',
  active boolean NOT NULL DEFAULT false,
  auto_retry boolean NOT NULL DEFAULT true,
  max_daily_external_actions integer NOT NULL DEFAULT 50,
  max_monthly_model_cost_cny numeric NOT NULL DEFAULT 0,
  approval_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  stop_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  source_platform text,
  source_campaign text,
  consent_status text NOT NULL DEFAULT 'unknown',
  intent conversation_intent NOT NULL DEFAULT 'medium',
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  name text NOT NULL,
  stage opportunity_stage NOT NULL DEFAULT 'new',
  estimated_value_cny numeric NOT NULL DEFAULT 0,
  probability numeric NOT NULL DEFAULT 0,
  next_action text,
  next_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  external_order_id text,
  product_name text NOT NULL,
  amount_cny numeric NOT NULL DEFAULT 0,
  refund_amount_cny numeric NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_order_id)
);

CREATE TABLE IF NOT EXISTS attribution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  content_brief_id uuid REFERENCES content_briefs(id) ON DELETE SET NULL,
  publish_job_id uuid REFERENCES publish_jobs(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  channel text,
  campaign text,
  attributed_revenue_cny numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operating_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  severity text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL,
  status exception_status NOT NULL DEFAULT 'open',
  resolution_action text,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Provider-neutral model registry. Only a secret-manager reference is stored;
-- API keys must never be written to this table or returned to the browser.
CREATE TABLE IF NOT EXISTS model_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  protocol text NOT NULL,
  base_url text,
  credential_ref text,
  status text NOT NULL DEFAULT 'configurable',
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES model_providers(id) ON DELETE CASCADE,
  code text NOT NULL,
  display_name text NOT NULL,
  model_name text NOT NULL,
  priority text NOT NULL,
  input_cost_per_million numeric,
  output_cost_per_million numeric,
  latency_target_ms integer,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, code)
);

CREATE TABLE IF NOT EXISTS tenant_model_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  task_kind text NOT NULL,
  primary_profile_id uuid NOT NULL REFERENCES model_profiles(id),
  fallback_profile_id uuid REFERENCES model_profiles(id),
  quality_gate jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget_limit_cny numeric,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, agent_id, task_kind)
);

CREATE TABLE IF NOT EXISTS model_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  workflow_step_id uuid REFERENCES workflow_steps(id) ON DELETE SET NULL,
  model_profile_id uuid REFERENCES model_profiles(id) ON DELETE SET NULL,
  request_id text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  latency_ms integer,
  cost_cny numeric NOT NULL DEFAULT 0,
  quality_score numeric,
  fallback_used boolean NOT NULL DEFAULT false,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant_id ON knowledge_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_tenant_id ON video_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_tenant_status ON publish_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_intent ON conversations(tenant_id, intent);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status ON subscriptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_tenant ON tenant_feature_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_goals_tenant_period ON revenue_goals(tenant_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_intent ON contacts(tenant_id, intent);
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_stage ON opportunities(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_attribution_events_tenant_time ON attribution_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_operating_exceptions_tenant_status ON operating_exceptions(tenant_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_tenant_model_routes_tenant ON tenant_model_routes(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_model_usage_events_tenant_time ON model_usage_events(tenant_id, created_at DESC);

-- Runtime adapter tables used by the current Next.js implementation.
-- These keep the local demo tenant ids as text so the app can switch from
-- .local-data to PostgreSQL without rewriting the current UI layer first.
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

CREATE TABLE IF NOT EXISTS app_tenant_feature_overrides (
  tenant_id text NOT NULL,
  feature_key text NOT NULL,
  enabled boolean NOT NULL,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, feature_key)
);

CREATE TABLE IF NOT EXISTS app_risk_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  type text NOT NULL,
  level text NOT NULL,
  action text NOT NULL,
  owner text NOT NULL,
  status text NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_acquisition_plans (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  industry text NOT NULL,
  product text NOT NULL,
  customer_profile text NOT NULL,
  hook text NOT NULL,
  daily_lead_target integer NOT NULL,
  risk_mode text NOT NULL,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_reply_strategy_snapshots (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  test_message text,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_content_drafts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  title text NOT NULL,
  hook text NOT NULL,
  body text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text
);

CREATE TABLE IF NOT EXISTS app_video_workflow_jobs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  content_draft_id text,
  title text NOT NULL,
  source_title text NOT NULL,
  script text NOT NULL,
  stage text NOT NULL,
  platform_versions jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_publish_plan_records (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  video_job_id text,
  platform text NOT NULL,
  mode text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  scheduled_at timestamptz,
  package_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_conversation_action_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  conversation_id text NOT NULL,
  action text NOT NULL,
  note text NOT NULL,
  status text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_schema_migrations (
  id text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_uploads_tenant_created ON app_uploads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_jobs_tenant_status ON app_queue_jobs(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_audit_tenant_created ON app_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_tenant_drafts_created ON app_tenant_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_model_usage_tenant_created ON app_model_usage_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_connectors_tenant_status ON app_connector_connections(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_app_billing_tenant_created ON app_billing_records(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_feature_overrides_tenant ON app_tenant_feature_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_risk_events_tenant_status ON app_risk_events(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_acquisition_plans_tenant_created ON app_acquisition_plans(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_reply_strategy_tenant_updated ON app_reply_strategy_snapshots(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_content_drafts_tenant_created ON app_content_drafts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_video_workflow_tenant_created ON app_video_workflow_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_publish_plan_tenant_status ON app_publish_plan_records(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_conversation_actions_tenant_created ON app_conversation_action_events(tenant_id, created_at DESC);
