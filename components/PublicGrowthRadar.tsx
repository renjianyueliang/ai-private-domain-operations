"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, MapPin, Radar, Search, ShieldCheck, Sparkles } from "lucide-react";
import { getRadarOpportunitiesForTenant } from "../lib/workspace-product";
import { getTenantById } from "../lib/saas";

type PublicGrowthRadarProps = {
  tenantId: string;
};

export function PublicGrowthRadar({ tenantId }: PublicGrowthRadarProps) {
  const tenant = getTenantById(tenantId);
  const opportunities = useMemo(() => getRadarOpportunitiesForTenant(tenant.id), [tenant.id]);
  const [keyword, setKeyword] = useState(tenant.industryTemplate);
  const [region, setRegion] = useState("全国/同城");
  const tenantQuery = `?tenant=${encodeURIComponent(tenant.id)}`;

  return (
    <section className="workspace-page-shell" aria-label="公域获客雷达">
      <div className="workspace-page-hero">
        <div>
          <div className="section-kicker">公域获客雷达 <span>新增</span></div>
          <h1>发现值得跟进的关键词、评论和同行内容</h1>
          <p>这里不自动骚扰用户，只生成线索判断、内容机会和互动建议；执行动作必须走官方接口或人工确认。</p>
        </div>
        <button type="button" className="primary-button">
          <Radar size={17} />
          扫描机会
        </button>
      </div>

      <div className="radar-filter-bar">
        <label>
          <Search size={16} />
          关键词
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </label>
        <label>
          <MapPin size={16} />
          地区
          <input value={region} onChange={(event) => setRegion(event.target.value)} />
        </label>
        <label>
          平台
          <select defaultValue="all">
            <option value="all">全部平台</option>
            <option>抖音</option>
            <option>小红书</option>
            <option>视频号</option>
            <option>YouTube</option>
          </select>
        </label>
      </div>

      <div className="radar-opportunity-grid">
        {opportunities.map((item) => (
          <article key={item.id} className={`radar-card risk-${item.riskLevel}`}>
            <div className="radar-card-heading">
              <span><Radar size={17} />{item.platform}</span>
              <em>{item.intentScore} 分</em>
            </div>
            <strong>{item.keyword} · {item.region}</strong>
            <p>{item.signal}</p>
            <small>来源：{item.source}</small>
            <div className="radar-action-box">
              {item.riskLevel === "高" ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
              {item.suggestedAction}
            </div>
            <div className="radar-card-footer">
              <span className={`tag ${item.riskLevel === "高" ? "blocked" : item.riskLevel === "中" ? "review" : "ready"}`}>
                {item.riskLevel}风险
              </span>
              <a href={`/workspace/plan${tenantQuery}`}>转成获客计划</a>
            </div>
          </article>
        ))}
      </div>

      <div className="boundary-card">
        <ShieldCheck size={17} />
        真实环境要接平台官方搜索、开放平台、商家后台或人工采集导入；不做模拟登录、批量评论和绕风控互动。
      </div>
    </section>
  );
}
