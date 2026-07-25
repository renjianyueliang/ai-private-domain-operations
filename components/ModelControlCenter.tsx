"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRightLeft,
  BrainCircuit,
  Check,
  CircleDollarSign,
  CloudCog,
  KeyRound,
  LockKeyhole,
  Route,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  getModelProfile,
  initialModelRoutes,
  modelProfiles,
  modelProviders,
  type ModelProfileId,
  type ModelRoute,
} from "../lib/model-config";

const providerStatusLabels = {
  connected: "已连接",
  configurable: "可配置",
  offline: "未启用",
};

export function ModelControlCenter() {
  const [routes, setRoutes] = useState<ModelRoute[]>(initialModelRoutes);
  const [defaultProfile, setDefaultProfile] = useState<ModelProfileId>("balanced");
  const [monthlyBudget, setMonthlyBudget] = useState("5000");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">("idle");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const qualityRoutes = useMemo(
    () => routes.filter((route) => route.profileId === "quality").length,
    [routes],
  );
  const connectedProviders = modelProviders.filter((provider) => provider.status === "connected").length;
  const selectedProvider = modelProviders.find((provider) => provider.id === selectedProviderId);

  function updateRoute(routeId: string, profileId: ModelProfileId) {
    setRoutes((current) => current.map((route) => route.id === routeId ? { ...route, profileId } : route));
    setSaveState("dirty");
  }

  return (
    <section id="admin-ai" className="model-control-center" aria-label="AI模型与自动化中心">
      <div className="model-control-heading">
        <div>
          <div className="section-kicker">AI 与自动化</div>
          <h2>统一配置模型、路由、备用和成本</h2>
          <p>平台设置默认策略，客户可按套餐覆盖；普通客户只看到质量、均衡、成本和私有四种模式。</p>
        </div>
        <button type="button" onClick={() => setSaveState("saved")} disabled={saveState !== "dirty"}>
          {saveState === "saved" ? <Check size={17} /> : <Save size={17} />}
          {saveState === "saved" ? "已保存" : "保存更改"}
        </button>
      </div>

      {saveState === "dirty" && <div className="model-save-banner dirty" role="status"><Activity size={16} />存在未保存更改。离开前请保存当前模型策略。</div>}
      {saveState === "saved" && <div className="model-save-banner" role="status"><Check size={16} />模型路由策略已保存为演示配置。生产环境将写入数据库和审计日志。</div>}

      <div className="model-summary-grid">
        <article><span className="metric-icon green"><CloudCog size={18} /></span><div><small>已连接模型</small><strong>{connectedProviders} / {modelProviders.length}</strong><em>其余等待服务器端配置</em></div></article>
        <article><span className="metric-icon blue"><Route size={18} /></span><div><small>任务路由</small><strong>{routes.length}</strong><em>按员工与任务选择</em></div></article>
        <article><span className="metric-icon violet"><BrainCircuit size={18} /></span><div><small>质量优先任务</small><strong>{qualityRoutes}</strong><em>复杂推理与合规</em></div></article>
        <article><span className="metric-icon amber"><CircleDollarSign size={18} /></span><div><small>月度预算</small><strong>¥{Number(monthlyBudget || 0).toLocaleString("zh-CN")}</strong><em>超额自动降级或暂停</em></div></article>
      </div>

      <div className="model-admin-grid">
        <article className="model-provider-panel">
          <div className="model-panel-heading"><div><strong>模型连接</strong><span>密钥加密保存，页面不回显</span></div><KeyRound size={19} /></div>
          <div className="model-provider-list">
            {modelProviders.map((provider) => (
              <div key={provider.id}>
                <span className={`provider-mark ${provider.status}`}><BrainCircuit size={18} /></span>
                <div><strong>{provider.name}</strong><small>{provider.protocol} · {provider.description}</small></div>
                <em className={provider.status}>{providerStatusLabels[provider.status]}</em>
                <button
                  type="button"
                  aria-expanded={selectedProviderId === provider.id}
                  onClick={() => setSelectedProviderId((current) => current === provider.id ? null : provider.id)}
                >
                  {selectedProviderId === provider.id ? "收起" : "查看要求"}
                </button>
              </div>
            ))}
          </div>
          {selectedProvider && (
            <div className="model-provider-requirements" role="region" aria-live="polite" aria-label={`${selectedProvider.name}接入要求`}>
              <strong>{selectedProvider.name}接入要求</strong>
              <p>{selectedProvider.protocol} · {selectedProvider.description}</p>
              <ul>
                <li>由服务器端保存并加密密钥，前端页面不采集或回显密钥。</li>
                <li>完成健康检查、超时重试和备用模型切换后才标记为已连接。</li>
                <li>每次调用记录租户、任务、耗时、成本和质量结果。</li>
              </ul>
            </div>
          )}
          <div className="model-secret-note"><LockKeyhole size={16} />企业客户可使用自己的密钥或私有端点；密钥不进入提示词、日志和前端。</div>
        </article>

        <article className="model-policy-panel">
          <div className="model-panel-heading"><div><strong>默认运行策略</strong><span>没有单独配置时继承此策略</span></div><SlidersHorizontal size={19} /></div>
          <div className="model-profile-grid">
            {modelProfiles.map((profile) => (
              <button key={profile.id} type="button" className={defaultProfile === profile.id ? "active" : ""} aria-pressed={defaultProfile === profile.id} onClick={() => { setDefaultProfile(profile.id); setSaveState("dirty"); }}>
                <strong>{profile.name}</strong><span>{profile.description}</span>
              </button>
            ))}
          </div>
          <label className="model-budget-field">租户默认月度模型预算
            <span><em>¥</em><input type="number" min="0" step="100" value={monthlyBudget} onChange={(event) => { setMonthlyBudget(event.target.value); setSaveState("dirty"); }} /></span>
          </label>
          <div className="model-guardrails"><ShieldCheck size={17} /><span><strong>预算保护已开启</strong>达到 80% 提醒，达到 100% 后低风险任务降级，高风险任务暂停并等待管理员确认。</span></div>
        </article>
      </div>

      <article className="model-routing-panel">
        <div className="model-panel-heading"><div><strong>AI员工任务路由</strong><span>每类任务都有主策略、备用策略和质量门槛</span></div><ArrowRightLeft size={19} /></div>
        <div className="model-route-table" role="table" aria-label="AI员工模型路由">
          <div role="rowgroup">
            <div className="model-route-row header" role="row"><span role="columnheader">任务</span><span role="columnheader">AI员工</span><span role="columnheader">主策略</span><span role="columnheader">备用</span><span role="columnheader">质量门槛</span></div>
          </div>
          <div role="rowgroup">
            {routes.map((route) => (
              <div key={route.id} className="model-route-row" role="row">
                <strong role="cell">{route.task}</strong>
                <span role="cell">{route.employee}</span>
                <span role="cell"><select aria-label={`${route.task}主策略`} value={route.profileId} onChange={(event) => updateRoute(route.id, event.target.value as ModelProfileId)}>
                  {modelProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                </select></span>
                <span role="cell">{getModelProfile(route.fallbackProfileId).name}</span>
                <small role="cell">{route.qualityGate}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="model-routing-footer"><Activity size={16} />调用失败、超时或质量不达标时自动切换备用策略；所有切换都会记录成本、耗时和最终业务结果。</div>
      </article>
    </section>
  );
}
