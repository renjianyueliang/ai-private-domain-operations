"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  PackageCheck,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  featureDescriptions,
  featureLabels,
  getTenantEntitlement,
  type FeatureKey,
} from "../lib/entitlements";
import { formatNumber, saasTenants } from "../lib/saas";
import type { FeatureMatrixRecord } from "../lib/control-store";

const featureGroups: Array<{
  title: string;
  description: string;
  features: FeatureKey[];
}> = [
  {
    title: "基础能力",
    description: "客户开通后必须先具备资料、内容和合规能力。",
    features: ["knowledge_upload", "content_factory", "advanced_compliance", "analytics_dashboard"],
  },
  {
    title: "视频与分发",
    description: "从视频任务到平台发布，按套餐和账号授权逐步开放。",
    features: ["video_factory", "publish_center", "youtube_connector", "tiktok_connector", "manual_asset_pack"],
  },
  {
    title: "私域承接",
    description: "只接官方能力和客户主动触达后的会话承接。",
    features: ["conversation_center", "wecom_connector", "wechat_service_connector", "telegram_connector"],
  },
  {
    title: "团队与交付",
    description: "多成员协作、客户成功、交付管理和经营复盘。",
    features: ["team_members"],
  },
];

function getInitialMatrix() {
  const matrix: Record<string, Record<FeatureKey, boolean>> = {};

  saasTenants.forEach((tenant) => {
    const entitlement = getTenantEntitlement(tenant);
    matrix[tenant.id] = Object.keys(featureLabels).reduce(
      (current, feature) => ({
        ...current,
        [feature]: entitlement.enabledFeatures.includes(feature as FeatureKey),
      }),
      {} as Record<FeatureKey, boolean>,
    );
  });

  return matrix;
}

export function AdminFeatureControlCenter() {
  const [selectedTenantId, setSelectedTenantId] = useState(saasTenants[0]?.id ?? "");
  const [matrix, setMatrix] = useState(getInitialMatrix);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">("idle");
  const [message, setMessage] = useState("功能授权使用当前套餐默认值；保存后会写入本地记录或 PostgreSQL。");
  const [isSaving, setIsSaving] = useState(false);

  const selectedTenant = saasTenants.find((tenant) => tenant.id === selectedTenantId) ?? saasTenants[0];
  const selectedEntitlement = getTenantEntitlement(selectedTenant);
  const selectedFeatures = matrix[selectedTenant.id] ?? ({} as Record<FeatureKey, boolean>);
  const enabledCount = Object.values(selectedFeatures).filter(Boolean).length;
  const lockedCount = Object.values(selectedFeatures).filter((enabled) => !enabled).length;

  const tenantRows = useMemo(
    () =>
      saasTenants.map((tenant) => {
        const entitlement = getTenantEntitlement(tenant);
        const tenantMatrix = matrix[tenant.id] ?? ({} as Record<FeatureKey, boolean>);
        return {
          tenant,
          entitlement,
          enabledCount: Object.values(tenantMatrix).filter(Boolean).length,
        };
      }),
    [matrix],
  );

  function toggleFeature(feature: FeatureKey) {
    setMatrix((current) => ({
      ...current,
      [selectedTenant.id]: {
        ...current[selectedTenant.id],
        [feature]: !current[selectedTenant.id]?.[feature],
      },
    }));
    setSaveState("dirty");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMatrix() {
      try {
        const response = await fetch("/api/admin/features");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "读取功能授权失败。");

        if (!cancelled && Array.isArray(data.featureMatrix)) {
          setMatrix((current) => {
            const next = { ...current };
            data.featureMatrix.forEach((record: FeatureMatrixRecord) => {
              next[record.tenantId] = record.features;
            });
            return next;
          });
          setMessage(`已载入功能授权矩阵，存储模式：${data.storageMode}。`);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取功能授权失败。");
        }
      }
    }

    loadMatrix();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveSelectedMatrix() {
    if (isSaving) return;
    setIsSaving(true);
    setMessage("正在保存功能授权...");

    try {
      const response = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          features: selectedFeatures,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "保存功能授权失败。");

      setSaveState("saved");
      setMessage(`已保存 ${selectedTenant.name} 的功能授权，更新时间：${new Date(data.record.updatedAt).toLocaleString("zh-CN")}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存功能授权失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section id="admin-features" className="admin-section" aria-label="功能授权矩阵">
      <div className="section-heading-row">
        <div>
          <div className="section-kicker">功能授权矩阵</div>
          <h2>按客户、套餐、行业风险控制可用功能</h2>
        </div>
        <p>
          这里解决“同一套 SaaS 卖给不同行业客户”的问题。后台决定客户能看到什么功能、
          哪些动作必须人工审核、哪些连接器只能作为素材包或待授权状态。
        </p>
      </div>

      <div className="feature-admin-summary">
        <article>
          <PackageCheck size={19} />
          <div>
            <span>当前客户</span>
            <strong>{selectedTenant.name}</strong>
            <small>{selectedEntitlement.plan.name} · {selectedTenant.industryTemplate}</small>
          </div>
        </article>
        <article>
          <CheckCircle2 size={19} />
          <div>
            <span>已开通功能</span>
            <strong>{enabledCount}</strong>
            <small>锁定 {lockedCount} 项</small>
          </div>
        </article>
        <article>
          <ShieldCheck size={19} />
          <div>
            <span>合规模式</span>
            <strong>{selectedTenant.industryTemplate}</strong>
            <small>{selectedTenant.complianceProfile}</small>
          </div>
        </article>
      </div>

      {saveState === "dirty" && (
        <div className="model-save-banner dirty" role="status">
          <CircleAlert size={16} />
          {message}
        </div>
      )}
      {saveState === "saved" && (
        <div className="model-save-banner" role="status">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}
      {saveState === "idle" && (
        <div className="model-save-banner" role="status">
          <ShieldCheck size={16} />
          {message}
        </div>
      )}

      <div className="feature-admin-layout">
        <aside className="feature-tenant-list" aria-label="客户列表">
          {tenantRows.map(({ tenant, entitlement, enabledCount: count }) => (
            <button
              key={tenant.id}
              type="button"
              className={tenant.id === selectedTenant.id ? "active" : ""}
              onClick={() => setSelectedTenantId(tenant.id)}
            >
              <span>{tenant.name}</span>
              <strong>{entitlement.plan.name}</strong>
              <small>
                {count} 项功能 · {formatNumber(tenant.usage.contacts)} 线索
              </small>
            </button>
          ))}
        </aside>

        <div className="feature-matrix-panel">
          <div className="feature-matrix-heading">
            <div>
              <strong>{selectedTenant.name}</strong>
              <span>后台开关影响客户工作台可见模块和 API 权限。</span>
            </div>
            <button type="button" onClick={saveSelectedMatrix} disabled={saveState !== "dirty" || isSaving}>
              <Save size={16} />
              {isSaving ? "保存中" : saveState === "dirty" ? "保存权限" : "无待保存"}
            </button>
          </div>

          <div className="feature-group-list">
            {featureGroups.map((group) => (
              <article key={group.title} className="feature-group-card">
                <div className="feature-group-heading">
                  <div>
                    <strong>{group.title}</strong>
                    <span>{group.description}</span>
                  </div>
                  <SlidersHorizontal size={18} />
                </div>

                <div className="feature-toggle-grid">
                  {group.features.map((feature) => {
                    const enabled = Boolean(selectedFeatures[feature]);
                    const includedByPlan = selectedEntitlement.plan.includedFeatures.includes(feature);
                    return (
                      <button
                        type="button"
                        key={feature}
                        className={enabled ? "enabled" : ""}
                        onClick={() => toggleFeature(feature)}
                        aria-pressed={enabled}
                      >
                        {enabled ? <ToggleRight size={21} /> : <ToggleLeft size={21} />}
                        <span>
                          <strong>{featureLabels[feature]}</strong>
                          <small>{featureDescriptions[feature]}</small>
                        </span>
                        <em>{includedByPlan ? "套餐内" : "加购/锁定"}</em>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-boundary-strip inline-boundary">
        <LockKeyhole size={17} />
        <span>
          客户端必须由后端权限校验兜底，不能只依赖前端隐藏菜单。视频上传、发布、私信发送等接口已按套餐能力做拦截骨架。
        </span>
      </div>
    </section>
  );
}
