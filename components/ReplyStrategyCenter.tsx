"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, BookOpenCheck, CheckCircle2, MessageSquareText, PlayCircle, ShieldAlert, ToggleLeft, ToggleRight } from "lucide-react";
import { getReplyRulesForTenant, type ReplyRule } from "../lib/workspace-product";
import { getTenantById } from "../lib/saas";

type ReplyStrategyCenterProps = {
  tenantId: string;
};

type KnowledgeSourceView = {
  uploadId: string;
  title: string;
  summary: string;
  chunks: Array<{ id: string; title: string; text: string }>;
  canUseForAi: boolean;
};

export function ReplyStrategyCenter({ tenantId }: ReplyStrategyCenterProps) {
  const tenant = getTenantById(tenantId);
  const initialRules = useMemo(() => getReplyRulesForTenant(tenant.id), [tenant.id]);
  const [rules, setRules] = useState(initialRules);
  const [testMessage, setTestMessage] = useState("我想领取资料，能不能保证有效？");
  const [message, setMessage] = useState("策略使用行业默认规则；保存后会进入本地记录。");
  const [isSaving, setIsSaving] = useState(false);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceView[]>([]);

  const matchedRule =
    rules.find((rule) =>
      rule.enabled && rule.trigger.split(/[、\s/]+/).some((word) => word && testMessage.includes(word)),
    ) ?? rules[0];

  useEffect(() => {
    let cancelled = false;

    async function loadStrategy() {
      try {
        const response = await fetch(`/api/workspace/reply-strategies?tenantId=${encodeURIComponent(tenant.id)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "读取回复策略失败。");
        if (!cancelled && data.replyStrategy?.rules?.length) {
          setRules(data.replyStrategy.rules as ReplyRule[]);
          if (data.replyStrategy.testMessage) setTestMessage(data.replyStrategy.testMessage);
          setMessage(`已载入回复策略，存储模式：${data.storageMode}，更新时间：${new Date(data.replyStrategy.updatedAt).toLocaleString("zh-CN")}。`);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取回复策略失败。");
        }
      }
    }

    loadStrategy();
    return () => {
      cancelled = true;
    };
  }, [tenant.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadKnowledgeSources() {
      try {
        const response = await fetch(`/api/workspace-state?tenantId=${encodeURIComponent(tenant.id)}`);
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
  }, [tenant.id]);

  async function saveStrategy() {
    if (isSaving) return;
    setIsSaving(true);
    setMessage("正在保存回复策略...");

    try {
      const response = await fetch("/api/workspace/reply-strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          rules,
          testMessage,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "保存回复策略失败。");
      setMessage(`回复策略已保存，编号 ${String(data.record.id).slice(0, 8)}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存回复策略失败。");
    } finally {
      setIsSaving(false);
    }
  }

  const usableKnowledgeSources = knowledgeSources.filter((source) => source.canUseForAi);
  const selectedKnowledge = usableKnowledgeSources[0];

  return (
    <section className="workspace-page-shell" aria-label="自动回复策略配置">
      <div className="workspace-page-hero">
        <div>
          <div className="section-kicker">自动回复策略 <span>新增</span></div>
          <h1>先配置规则，再让 AI 给出安全回复建议</h1>
          <p>客户可配置关键词、资料入口、转人工规则和风险拦截。高风险内容不自动发送。</p>
        </div>
        <button type="button" className="primary-button" onClick={saveStrategy} disabled={isSaving}>
          <MessageSquareText size={17} />
          {isSaving ? "保存中" : "保存策略"}
        </button>
      </div>

      <div className="model-save-banner" role="status">
        <CheckCircle2 size={16} />
        {message}
      </div>

      <div className="reply-strategy-layout">
        <article className="reply-rule-list">
          <div className="panel-heading compact">
            <span>回复规则</span>
            <small>{tenant.name}</small>
          </div>
          {rules.map((rule) => (
            <div key={rule.id} className="reply-rule-card">
              <button
                type="button"
                aria-label={`${rule.enabled ? "关闭" : "开启"}${rule.name}`}
                onClick={() => setRules((current) => current.map((item) =>
                  item.id === rule.id ? { ...item, enabled: !item.enabled } : item,
                ))}
              >
                {rule.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
              <div>
                <strong>{rule.name}</strong>
                <span>触发：{rule.trigger}</span>
                <p>{rule.reply}</p>
              </div>
              <em className={rule.riskMode === "必须人工" ? "blocked" : "review"}>{rule.riskMode}</em>
            </div>
          ))}
        </article>

        <article className="reply-simulator">
          <div className="panel-heading compact">
            <span>对话模拟器</span>
            <small>上线前先测试</small>
          </div>
          <label>
            模拟客户消息
            <textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
          </label>
          <div className="simulated-reply">
            <Bot size={18} />
            <div>
              <strong>匹配规则：{matchedRule.name}</strong>
              <p>{matchedRule.reply}</p>
              <small>去向：{matchedRule.destination}</small>
            </div>
          </div>
          <div className="knowledge-reply-reference">
            <BookOpenCheck size={17} />
            <div>
              <strong>
                {selectedKnowledge ? `引用资料：${selectedKnowledge.title}` : "暂无可引用知识库"}
              </strong>
              <p>
                {selectedKnowledge
                  ? selectedKnowledge.chunks[0]?.text ?? selectedKnowledge.summary
                  : "上传并解析知识库后，AI 回复建议会显示可引用的客户资料片段。"}
              </p>
            </div>
          </div>
          <div className="risk-warning">
            <ShieldAlert size={15} />
            风险模式：{matchedRule.riskMode}。涉及收益、诊疗、效果、报价和合同的回复必须人工确认。
          </div>
          <button type="button" className="secondary-button">
            <PlayCircle size={16} />
            测试下一条
          </button>
        </article>
      </div>
    </section>
  );
}
