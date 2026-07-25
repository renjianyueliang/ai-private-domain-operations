import {
  formatNumber,
  saasReadiness,
  saasTenants,
  type SaasTenant,
  usagePercent,
} from "../lib/saas";
import {
  featureLabels,
  getTenantEntitlement,
  planDefinitions,
  statusLabel as subscriptionStatusLabel,
  statusTone as subscriptionStatusTone,
} from "../lib/entitlements";
import {
  getIndustryTemplateById,
  getTenantOperations,
  industryTemplates,
  summarizeOperations,
} from "../lib/operations";
import { AdminControlCenter } from "./AdminControlCenter";
import { ModelControlCenter } from "./ModelControlCenter";

const channelStatusLabels: Record<SaasTenant["channels"][number]["status"], string> = {
  connected: "已连接",
  mock: "演示数据",
  pending: "待配置",
  disabled: "未开放",
};

const knowledgeStatusLabels: Record<SaasTenant["knowledgeBase"][number]["status"], string> = {
  ready: "可用",
  review: "待审核",
  missing: "缺资料",
};

const launchSteps = [
  "选择客户行业模板：交易教学、金融、医美、中医或后续自定义行业。",
  "选择套餐：基础版、增长版、企业版，并写入到期时间和席位上限。",
  "开启功能：知识库、内容工厂、视频工厂、发布中心、企微/Telegram 等连接器。",
  "导入客户知识库和合规禁用表达，再让客户进入自己的工作台使用。",
];

function getConversionRate(tenant: SaasTenant) {
  if (tenant.funnel.leads <= 0) return "0%";
  return `${((tenant.funnel.paidOrders / tenant.funnel.leads) * 100).toFixed(1)}%`;
}

export function AdminDashboard() {
  const operationSummary = summarizeOperations();
  const tenantEntitlements = saasTenants.map((tenant) => ({
    tenant,
    entitlement: getTenantEntitlement(tenant),
  }));
  const metrics = {
    tenants: saasTenants.length,
    activeTenants: tenantEntitlements.filter(
      ({ entitlement }) => entitlement.subscriptionStatus === "active",
    ).length,
    trialTenants: tenantEntitlements.filter(
      ({ entitlement }) => entitlement.subscriptionStatus === "trial",
    ).length,
    expiredTenants: tenantEntitlements.filter(
      ({ entitlement }) => entitlement.subscriptionStatus === "expired",
    ).length,
    yearlyValue: tenantEntitlements.reduce(
      (sum, { entitlement }) => sum + entitlement.plan.annualPriceCny,
      0,
    ),
    contacts: saasTenants.reduce((sum, tenant) => sum + tenant.usage.contacts, 0),
    aiRuns: saasTenants.reduce((sum, tenant) => sum + tenant.usage.aiRuns, 0),
    videoJobs: saasTenants.reduce((sum, tenant) => sum + tenant.usage.videoJobs, 0),
    paidOrders: saasTenants.reduce((sum, tenant) => sum + tenant.funnel.paidOrders, 0),
    contentTasks: operationSummary.contentCount,
    videoTasks: operationSummary.videoCount,
    publishPlans: operationSummary.publishCount,
    conversations: operationSummary.conversationCount,
  };

  return (
    <main className="dashboard-shell admin-shell">
      <AdminControlCenter metrics={metrics} />
      <ModelControlCenter />

      <section id="admin-plans" className="admin-section" aria-label="客户开通流程">
        <div className="section-heading-row">
          <div>
            <div className="section-kicker">商业化开通</div>
            <h2>客户开通、套餐和功能授权</h2>
          </div>
          <p>
            这部分对应你未来卖给客户时的平台后台。平台方负责定义客户行业、套餐价格、
            到期时间、成员席位和可用功能；客户端只显示当前客户被授权的模块。
          </p>
        </div>
        <div className="launch-grid">
          <article className="launch-card">
            <strong>开通流程</strong>
            <ol>
              {launchSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
          {planDefinitions.map((plan) => (
            <article key={plan.id} className="plan-card">
              <div>
                <strong>{plan.name}</strong>
                <em>{plan.priceText}</em>
              </div>
              <p>{plan.description}</p>
              <span>{plan.recommendedFor}</span>
              <dl>
                <div>
                  <dt>席位</dt>
                  <dd>{plan.seatsLimit}</dd>
                </div>
                <div>
                  <dt>线索</dt>
                  <dd>{formatNumber(plan.contactsLimit)}</dd>
                </div>
                <div>
                  <dt>AI执行</dt>
                  <dd>{formatNumber(plan.aiRunsLimit)}</dd>
                </div>
                <div>
                  <dt>视频任务</dt>
                  <dd>{formatNumber(plan.videoJobsLimit)}</dd>
                </div>
              </dl>
              <div className="tag-cloud">
                {plan.includedFeatures.slice(0, 8).map((feature) => (
                  <small key={feature} className="tag ready">
                    {featureLabels[feature]}
                  </small>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="admin-customers" className="admin-section" aria-label="客户租户列表">
        <span id="admin-usage" className="anchor-marker" />
        <span id="admin-connectors" className="anchor-marker" />
        <div className="section-heading-row">
          <div>
            <div className="section-kicker">租户管理</div>
            <h2>客户工作区</h2>
          </div>
          <p>
            这里是 SaaS 平台方视角。客户自己登录后只进入对应的 `/workspace`，不会看到这张总表。
          </p>
        </div>

        <div className="tenant-card-list">
          {saasTenants.map((tenant) => {
            const operations = getTenantOperations(tenant.id);
            const industryTemplate = getIndustryTemplateById(operations.industryTemplateId);
            const entitlement = getTenantEntitlement(tenant);
            const enabledFeatures = entitlement.enabledFeatures.slice(0, 10);
            const lockedFeatures = entitlement.lockedFeatures.slice(0, 5);

            return (
            <article key={tenant.id} className="tenant-card">
              <div className="tenant-card-header">
                <div>
                  <h3>{tenant.name}</h3>
                  <span>
                    {tenant.workspace} · {industryTemplate.name} · {industryTemplate.riskLevel} · {tenant.owner}
                  </span>
                </div>
                <div className={`subscription-badge ${subscriptionStatusTone(entitlement.subscriptionStatus)}`}>
                  {subscriptionStatusLabel(entitlement.subscriptionStatus)}
                </div>
              </div>

              <div className="tenant-admin-grid">
                <div className="tenant-admin-block">
                  <strong>套餐授权</strong>
                  <dl>
                    <div>
                      <dt>套餐</dt>
                      <dd>{entitlement.plan.name}</dd>
                    </div>
                    <div>
                      <dt>价格</dt>
                      <dd>{entitlement.plan.priceText}</dd>
                    </div>
                    <div>
                      <dt>到期</dt>
                      <dd>{tenant.renewalDate}</dd>
                    </div>
                    <div>
                      <dt>转化率</dt>
                      <dd>{getConversionRate(tenant)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="tenant-admin-block">
                  <strong>用量</strong>
                  <div className="usage-list compact-usage">
                    {[
                      ["线索", tenant.usage.contacts, tenant.usage.contactsLimit],
                      ["AI执行", tenant.usage.aiRuns, tenant.usage.aiRunsLimit],
                      ["视频", tenant.usage.videoJobs, entitlement.plan.videoJobsLimit],
                      ["席位", tenant.usage.seats, tenant.usage.seatsLimit],
                    ].map(([label, value, limit]) => {
                      const current = Number(value);
                      const max = Number(limit);
                      return (
                        <div key={String(label)} className="usage-row">
                          <div>
                            <span>{label}</span>
                            <strong>
                              {formatNumber(current)} / {formatNumber(max)}
                            </strong>
                          </div>
                          <em>
                            <i style={{ width: `${usagePercent(current, max)}%` }} />
                          </em>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="tenant-admin-block">
                  <strong>漏斗</strong>
                  <div className="mini-funnel">
                    {[
                      ["线索", tenant.funnel.leads],
                      ["加私域", tenant.funnel.addedPrivate],
                      ["进群", tenant.funnel.groupJoined],
                      ["试听", tenant.funnel.bookedTrial],
                      ["成交", tenant.funnel.paidOrders],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <span>{label}</span>
                        <b>{formatNumber(Number(value))}</b>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tenant-admin-block">
                  <strong>功能开关</strong>
                  <div className="tag-cloud">
                    {enabledFeatures.map((feature) => (
                      <span key={feature} className="tag ready">
                        {featureLabels[feature]}
                      </span>
                    ))}
                    {lockedFeatures.map((feature) => (
                      <span key={feature} className="tag blocked">
                        锁：{featureLabels[feature]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="tenant-admin-block">
                  <strong>渠道与知识库</strong>
                  <div className="tag-cloud">
                    {tenant.channels.map((channel) => (
                      <span key={channel.name} className={`tag ${channel.status}`}>
                        {channel.name}：{channelStatusLabels[channel.status]}
                      </span>
                    ))}
                    {tenant.knowledgeBase.map((item) => (
                      <span key={item.title} className={`tag ${item.status}`}>
                        {item.title}：{knowledgeStatusLabels[item.status]}
                      </span>
                    ))}
                    <span className="tag ready">内容任务：{operations.contentBriefs.length}</span>
                    <span className="tag review">视频任务：{operations.videoJobs.length}</span>
                    <span className="tag mock">会话样例：{operations.conversations.length}</span>
                  </div>
                </div>
              </div>

              <div className="tenant-card-footer">
                <span>
                  行业模板：{industryTemplate.reviewMode}。合规规则：{tenant.complianceProfile}
                </span>
                <div className="tenant-actions">
                  <a href="#admin-plans">续费</a>
                  <a href="#admin-plans">升级套餐</a>
                  <a href="#admin-readiness">暂停规则</a>
                  <a href={`/workspace?tenant=${tenant.id}`}>预览客户工作台</a>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      </section>

      <section id="admin-industries" className="admin-section" aria-label="行业模板库">
        <div className="section-heading-row">
          <div>
            <div className="section-kicker">行业模板库</div>
            <h2>多行业合规模板</h2>
          </div>
          <p>
            后续客户开通时，平台管理员先选择行业模板，再导入客户知识库。
            AI 生成、视频剪辑、发布和会话回复都会继承该行业的禁用表达和人工确认规则。
          </p>
        </div>
        <div className="template-grid">
          {industryTemplates.map((template) => (
            <article key={template.id} className="template-card">
              <div>
                <strong>{template.name}</strong>
                <em>{template.riskLevel}</em>
              </div>
              <p>{template.description}</p>
              <span>{template.reviewMode}</span>
              <div className="tag-cloud">
                {template.prohibitedClaims.slice(0, 4).map((claim) => (
                  <small key={claim} className="tag blocked">
                    禁：{claim}
                  </small>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="admin-readiness" className="saas-panel admin-wide-panel" aria-label="SaaS 化进度">
        <div className="panel-heading compact">
          <span>SaaS 化进度</span>
          <small>服务器准备前后的开发边界</small>
        </div>
        <div className="readiness-grid">
          {saasReadiness.map((item) => (
            <div key={item.title}>
              <strong>{item.title}</strong>
              <em>{item.status}</em>
              <span>{item.description}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
