"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, FileText, Sparkles, Target } from "lucide-react";
import { getPlanDraftForTenant } from "../lib/workspace-product";
import { ClientLoopProgress } from "./ClientLoopProgress";

type AcquisitionPlanWizardProps = {
  tenantId: string;
};

type KnowledgeSourceView = {
  uploadId: string;
  title: string;
  summary: string;
  keywords: string[];
  chunks: Array<{ id: string; title: string; text: string }>;
  canUseForAi: boolean;
};

type ContentDraftView = {
  id: string;
  title: string;
  hook: string;
  body: string;
  citations: Array<{
    sourceTitle: string;
    chunkTitle: string;
    text: string;
  }>;
  status: string;
  createdAt: string;
};

export function AcquisitionPlanWizard({ tenantId }: AcquisitionPlanWizardProps) {
  const draft = useMemo(() => getPlanDraftForTenant(tenantId), [tenantId]);
  const [industry, setIndustry] = useState(draft.tenant.industryTemplate);
  const [product, setProduct] = useState(draft.product);
  const [customer, setCustomer] = useState(draft.customer);
  const [hook, setHook] = useState(draft.hook);
  const [dailyLeadTarget, setDailyLeadTarget] = useState(String(draft.dailyLeadTarget));
  const [riskMode, setRiskMode] = useState("高风险人工确认");
  const [selectedChannels, setSelectedChannels] = useState(
    draft.channels.length > 0 ? draft.channels : ["抖音", "小红书", "企业微信"],
  );
  const [generated, setGenerated] = useState(false);
  const [message, setMessage] = useState("填写后点击生成，会保存一条本地获客计划记录。");
  const [savedCount, setSavedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceView[]>([]);
  const [latestContentDraft, setLatestContentDraft] = useState<ContentDraftView | null>(null);
  const tenantQuery = `?tenant=${encodeURIComponent(tenantId)}`;

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      try {
        const [plansResponse, draftsResponse] = await Promise.all([
          fetch(`/api/workspace/acquisition-plans?tenantId=${encodeURIComponent(tenantId)}`),
          fetch(`/api/workspace/content-drafts?tenantId=${encodeURIComponent(tenantId)}`),
        ]);
        const plansData = await plansResponse.json();
        const draftsData = await draftsResponse.json();
        if (!plansResponse.ok) throw new Error(plansData.error ?? "读取获客计划失败。");
        if (!draftsResponse.ok) throw new Error(draftsData.error ?? "读取内容草稿失败。");
        if (!cancelled && Array.isArray(plansData.acquisitionPlans)) {
          setSavedCount(plansData.acquisitionPlans.length);
          setLatestContentDraft(Array.isArray(draftsData.contentDrafts) ? draftsData.contentDrafts[0] ?? null : null);
          setMessage(`已载入 ${plansData.acquisitionPlans.length} 条历史获客计划，存储模式：${plansData.storageMode}。`);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取获客计划失败。");
        }
      }
    }

    loadPlans();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    let cancelled = false;

    async function loadKnowledgeSources() {
      try {
        const response = await fetch(`/api/workspace-state?tenantId=${encodeURIComponent(tenantId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "读取知识库引用失败。");
        if (!cancelled) {
          setKnowledgeSources(Array.isArray(data.knowledgeSources) ? data.knowledgeSources : []);
        }
      } catch {
        if (!cancelled) setKnowledgeSources([]);
      }
    }

    loadKnowledgeSources();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const usableKnowledgeSources = knowledgeSources.filter((source) => source.canUseForAi);

  async function generateAndSave() {
    if (isSaving) return;
    setGenerated(true);
    setIsSaving(true);
    setMessage("正在保存获客计划...");

    try {
      const response = await fetch("/api/workspace/acquisition-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          industry,
          product,
          customer,
          hook,
          dailyLeadTarget: Number.parseInt(dailyLeadTarget, 10),
          riskMode,
          channels: selectedChannels,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "保存获客计划失败。");

      const draftResponse = await fetch("/api/workspace/content-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          product,
          customer,
          hook,
          platform: selectedChannels[0] ?? "短视频",
        }),
      });
      const draftData = await draftResponse.json();
      if (!draftResponse.ok) throw new Error(draftData.error ?? "生成内容草稿失败。");

      setSavedCount((count) => count + 1);
      setLatestContentDraft(draftData.record);
      setMessage(`已保存获客计划并生成内容草稿：${data.record.product}，计划编号 ${String(data.record.id).slice(0, 8)}。`);
      window.dispatchEvent(new CustomEvent("client-loop:changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存获客计划失败。");
    } finally {
      setIsSaving(false);
    }
  }

  function toggleChannel(channel: string) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  return (
    <section className="workspace-page-shell" aria-label="获客计划向导">
      <div className="workspace-page-hero">
        <div>
          <div className="section-kicker">获客计划向导 <span>可操作</span></div>
          <h1>客户只填业务目标，系统生成一条获客闭环</h1>
          <p>这页用于把行业、产品、目标客户、资料钩子和平台选择转成 AI 可执行战役。</p>
        </div>
        <button className="primary-button" type="button" onClick={generateAndSave} disabled={isSaving}>
          <Sparkles size={17} />
          {isSaving ? "保存中" : "生成并保存"}
        </button>
      </div>

      <div className="model-save-banner" role="status">
        <CheckCircle2 size={16} />
        {message} 当前共 {savedCount} 条计划。
      </div>

      <ClientLoopProgress tenantId={tenantId} current="plan" />

      <div className="wizard-layout">
        <article className="wizard-form-panel">
          <div className="panel-heading compact">
            <span>1. 基础目标</span>
            <small>{draft.tenant.name}</small>
          </div>
          <div className="wizard-form-grid">
            <label>行业模板
              <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
                <option>交易教学</option>
                <option>金融</option>
                <option>医美</option>
                <option>中医</option>
              </select>
            </label>
            <label>产品/服务
              <input value={product} onChange={(event) => setProduct(event.target.value)} />
            </label>
            <label className="full-field">目标客户
              <input value={customer} onChange={(event) => setCustomer(event.target.value)} />
            </label>
            <label className="full-field">资料钩子/引流承接
              <input value={hook} onChange={(event) => setHook(event.target.value)} />
            </label>
            <label>每日线索目标
              <input type="number" min="1" value={dailyLeadTarget} onChange={(event) => setDailyLeadTarget(event.target.value)} />
            </label>
            <label>风险等级
              <select value={riskMode} onChange={(event) => setRiskMode(event.target.value)}>
                <option>低风险自动建议</option>
                <option>中风险确认后发送</option>
                <option>高风险人工确认</option>
              </select>
            </label>
          </div>
        </article>

        <article className="wizard-form-panel">
          <div className="panel-heading compact">
            <span>2. 平台与边界</span>
            <small>官方能力优先</small>
          </div>
          <div className="channel-choice-grid">
            {["抖音", "小红书", "视频号", "YouTube", "TikTok", "企业微信", "微信客服", "Telegram"].map((channel) => (
              <button
                key={channel}
                type="button"
                className={selectedChannels.includes(channel) ? "active" : ""}
                onClick={() => toggleChannel(channel)}
              >
                <CheckCircle2 size={15} />
                {channel}
              </button>
            ))}
          </div>
          <div className="boundary-card">
            <ClipboardCheck size={17} />
            不使用个人号外挂、模拟点击、批量骚扰私信或绕平台风控；无官方授权时只生成素材包和操作清单。
          </div>
        </article>
      </div>

      <article className="knowledge-reference-panel">
        <div className="panel-heading compact">
          <span>3. 知识库引用</span>
          <small>{usableKnowledgeSources.length} 个资料可用于 AI 生成</small>
        </div>
        {usableKnowledgeSources.length === 0 ? (
          <p>
            当前还没有可引用的解析结果。请先到“知识库与素材”上传 TXT/MD/CSV/JSON 文件并执行队列；
            PDF/Word 后续需要服务器解析器。
          </p>
        ) : (
          <div className="knowledge-reference-grid">
            {usableKnowledgeSources.slice(0, 3).map((source) => (
              <div key={source.uploadId}>
                <FileText size={17} />
                <strong>{source.title}</strong>
                <p>{source.summary}</p>
                {source.keywords.length > 0 && <small>关键词：{source.keywords.slice(0, 5).join("、")}</small>}
              </div>
            ))}
          </div>
        )}
      </article>

      <article className={`generated-plan-card ${generated ? "visible" : ""}`}>
        <div className="panel-heading compact">
          <span>生成结果</span>
          <small>{generated ? "已生成战役草案" : "点击生成后展示"}</small>
        </div>
        {generated ? (
          <div className="generated-plan-grid">
            <div>
              <Target size={18} />
              <strong>战役目标</strong>
              <p>{draft.objective}；每日目标 {dailyLeadTarget || draft.dailyLeadTarget} 条线索。</p>
            </div>
            <div>
              <Sparkles size={18} />
              <strong>内容方向</strong>
              <p>
                围绕「{product}」生成 20 个选题、6 条短视频脚本、3 套私信承接话术。
                {usableKnowledgeSources[0] ? `优先引用《${usableKnowledgeSources[0].title}》。` : "当前会使用行业默认知识。"}
              </p>
            </div>
            <div>
              <ArrowRight size={18} />
              <strong>私域路径</strong>
              <p>内容曝光 → 评论/私信 → {hook} → {draft.privateTarget} → CRM 跟进。</p>
            </div>
          </div>
        ) : (
          <p className="empty-workspace-copy">填写目标后点击“生成获客计划”，系统会输出可执行战役草案。</p>
        )}
      </article>

      {latestContentDraft && (
        <article className="content-draft-card">
          <div className="panel-heading compact">
            <span>引用知识库生成的内容草稿</span>
            <small>{latestContentDraft.status === "needs_review" ? "待人工审核" : latestContentDraft.status}</small>
          </div>
          <h2>{latestContentDraft.title}</h2>
          <pre>{latestContentDraft.body}</pre>
          <div className="content-citation-list">
            {latestContentDraft.citations.length === 0 ? (
              <p>当前草稿未引用上传资料。请先到“知识库与素材”上传并执行解析队列。</p>
            ) : (
              latestContentDraft.citations.map((citation, index) => (
                <blockquote key={`${citation.sourceTitle}-${citation.chunkTitle}-${index}`}>
                  <strong>{citation.sourceTitle} · {citation.chunkTitle}</strong>
                  <span>{citation.text}</span>
                </blockquote>
              ))
            )}
          </div>
          <div className="generated-next-action">
            <a className="primary-button" href={`/workspace/review${tenantQuery}`}>
              <ClipboardCheck size={16} />
              去审核这条草稿
            </a>
            <a className="secondary-button" href={`/workspace/foundation${tenantQuery}`}>
              <FileText size={16} />
              补充知识库资料
            </a>
          </div>
        </article>
      )}

      <div className="milestone-strip">
        {draft.milestones.map((item, index) => (
          <span key={item}><em>{index + 1}</em>{item}</span>
        ))}
      </div>
    </section>
  );
}
