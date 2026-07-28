"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  RefreshCw,
  Scissors,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { getTenantById } from "../lib/saas";
import { ClientLoopProgress } from "./ClientLoopProgress";

type DraftStatus = "needs_review" | "approved" | "rejected" | "video_queued";

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
  status: DraftStatus;
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

type VideoJobView = {
  id: string;
  contentDraftId?: string;
  title: string;
  stage: string;
  sourceTitle: string;
};

type ClientReviewCenterProps = {
  tenantId: string;
};

const statusLabels: Record<DraftStatus, string> = {
  needs_review: "待审核",
  approved: "已通过",
  rejected: "已驳回",
  video_queued: "已进视频",
};

function formatTime(value?: string) {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ClientReviewCenter({ tenantId }: ClientReviewCenterProps) {
  const tenant = getTenantById(tenantId);
  const [drafts, setDrafts] = useState<ContentDraftView[]>([]);
  const [videoJobs, setVideoJobs] = useState<VideoJobView[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [message, setMessage] = useState("读取内容草稿中...");
  const [isBusy, setIsBusy] = useState(false);
  const tenantQuery = `?tenant=${encodeURIComponent(tenant.id)}`;

  async function loadData() {
    try {
      const [draftResponse, videoResponse] = await Promise.all([
        fetch(`/api/workspace/content-drafts?tenantId=${encodeURIComponent(tenant.id)}`),
        fetch(`/api/workspace/video-jobs?tenantId=${encodeURIComponent(tenant.id)}`),
      ]);
      const draftData = await draftResponse.json();
      const videoData = await videoResponse.json();
      if (!draftResponse.ok) throw new Error(draftData.error ?? "读取内容草稿失败。");
      if (!videoResponse.ok) throw new Error(videoData.error ?? "读取视频任务失败。");

      const nextDrafts = Array.isArray(draftData.contentDrafts) ? draftData.contentDrafts : [];
      setDrafts(nextDrafts);
      setVideoJobs(Array.isArray(videoData.videoJobs) ? videoData.videoJobs : []);
      setSelectedId((current) => current ?? nextDrafts[0]?.id);
      setMessage(`已载入 ${nextDrafts.length} 条内容草稿，存储模式：${draftData.storageMode}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取审核数据失败。");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await loadData();
      if (cancelled) return;
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  const selected = useMemo(
    () => drafts.find((draft) => draft.id === selectedId) ?? drafts[0],
    [drafts, selectedId],
  );
  const linkedVideoJob = selected
    ? videoJobs.find((job) => job.contentDraftId === selected.id)
    : undefined;
  const reviewStats = {
    total: drafts.length,
    waiting: drafts.filter((draft) => draft.status === "needs_review").length,
    approved: drafts.filter((draft) => draft.status === "approved").length,
    queued: drafts.filter((draft) => draft.status === "video_queued").length,
  };

  async function updateDraft(status: DraftStatus, reviewNote: string) {
    if (!selected || isBusy) return;
    setIsBusy(true);
    setMessage("正在保存审核结果...");
    try {
      const response = await fetch("/api/workspace/content-drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          draftId: selected.id,
          status,
          reviewNote,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "保存审核结果失败。");
      await loadData();
      setMessage(`已更新审核状态：${statusLabels[data.record.status as DraftStatus] ?? data.record.status}。`);
      window.dispatchEvent(new CustomEvent("client-loop:changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存审核结果失败。");
    } finally {
      setIsBusy(false);
    }
  }

  async function createVideoJob() {
    if (!selected || isBusy) return;
    if (linkedVideoJob) {
      setMessage(`这条草稿已经生成视频任务：${linkedVideoJob.title}。`);
      return;
    }
    setIsBusy(true);
    setMessage("正在审核通过并生成视频任务...");
    try {
      const response = await fetch("/api/workspace/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          contentDraftId: selected.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "生成视频任务失败。");
      await loadData();
      setMessage(`已完成闭环下一步：${data.record.title} 已进入视频创作中心。`);
      window.dispatchEvent(new CustomEvent("client-loop:changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成视频任务失败。");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="workspace-page-shell client-review-center" aria-label="内容审核中心">
      <div className="workspace-page-hero">
        <div>
          <div className="section-kicker">内容审核中心 <span>可操作</span></div>
          <h1>把 AI 草稿审核后流转到视频任务</h1>
          <p>
            {tenant.name} 的客户侧审核入口。这里负责确认内容能否对外使用，并保留审核记录；
            通过后可一键进入视频创作中心。
          </p>
        </div>
        <a className="secondary-button" href={`/workspace/plan${tenantQuery}`}>
          <FileText size={17} />
          生成新草稿
        </a>
      </div>

      <div className="review-kpi-grid">
        <article><span>全部草稿</span><strong>{reviewStats.total}</strong><small>来自获客计划</small></article>
        <article><span>待审核</span><strong>{reviewStats.waiting}</strong><small>发布前必看</small></article>
        <article><span>已通过</span><strong>{reviewStats.approved}</strong><small>可进入视频</small></article>
        <article><span>视频任务</span><strong>{reviewStats.queued}</strong><small>已流转</small></article>
      </div>

      <div className="model-save-banner" role="status">
        <CheckCircle2 size={16} />
        {message}
      </div>

      <ClientLoopProgress tenantId={tenant.id} current="review" />

      {drafts.length === 0 ? (
        <article className="empty-client-state">
          <FileText size={22} />
          <strong>还没有内容草稿</strong>
          <p>先到“AI 获客计划”生成一条战役，系统会自动创建可审核的内容脚本。</p>
          <a className="primary-button" href={`/workspace/plan${tenantQuery}`}>去生成获客计划</a>
        </article>
      ) : (
        <div className="review-workflow-layout">
          <aside className="content-draft-list" aria-label="内容草稿列表">
            <div className="panel-heading compact">
              <span>待处理草稿</span>
              <small>{tenant.name}</small>
            </div>
            {drafts.map((draft) => (
              <button
                key={draft.id}
                type="button"
                className={draft.id === selected?.id ? "active" : ""}
                onClick={() => setSelectedId(draft.id)}
              >
                <span className={`draft-status-badge ${draft.status}`}>{statusLabels[draft.status]}</span>
                <strong>{draft.title}</strong>
                <small>{formatTime(draft.createdAt)} · {draft.citations.length} 条引用</small>
              </button>
            ))}
          </aside>

          <article className="content-draft-detail">
            {selected && (
              <>
                <div className="panel-heading compact">
                  <span>{selected.title}</span>
                  <small>{statusLabels[selected.status]} · {formatTime(selected.reviewedAt)}</small>
                </div>
                <div className="draft-hook-card">
                  <strong>引流钩子</strong>
                  <p>{selected.hook}</p>
                </div>
                <pre>{selected.body}</pre>
                <div className="content-citation-list">
                  {selected.citations.length === 0 ? (
                    <p>未引用上传资料。建议先补知识库，再生成最终版脚本。</p>
                  ) : (
                    selected.citations.map((citation, index) => (
                      <blockquote key={`${citation.sourceTitle}-${citation.chunkTitle}-${index}`}>
                        <strong>{citation.sourceTitle} · {citation.chunkTitle}</strong>
                        <span>{citation.text}</span>
                      </blockquote>
                    ))
                  )}
                </div>
                <div className="review-safety-box">
                  <ShieldCheck size={17} />
                  <div>
                    <strong>审核边界</strong>
                    <p>金融、交易、医美、中医等高风险行业不自动承诺收益、疗效、诊疗或成交结果；外发前保留人工确认。</p>
                  </div>
                </div>
                {selected.reviewNote && (
                  <div className="draft-review-note">
                    <strong>最近审核记录</strong>
                    <span>{selected.reviewNote} · {selected.reviewedBy ?? "系统"}</span>
                  </div>
                )}
                {linkedVideoJob && (
                  <div className="draft-review-note success">
                    <strong>已生成视频任务</strong>
                    <span>{linkedVideoJob.title} · {linkedVideoJob.stage}</span>
                    <a href={`/workspace/video${tenantQuery}`}>去视频创作中心</a>
                  </div>
                )}
                <div className="content-draft-actions">
                  <button type="button" onClick={() => updateDraft("approved", "人工确认内容可进入视频制作。")} disabled={isBusy}>
                    <CheckCircle2 size={15} />
                    审核通过
                  </button>
                  <button type="button" onClick={() => updateDraft("rejected", "内容需要重新修改后再审核。")} disabled={isBusy}>
                    <XCircle size={15} />
                    驳回修改
                  </button>
                  <button type="button" className="primary-inline" onClick={createVideoJob} disabled={isBusy}>
                    {isBusy ? <RefreshCw size={15} /> : <Scissors size={15} />}
                    {linkedVideoJob
                      ? "已生成视频任务"
                      : selected.status === "needs_review"
                        ? "审核通过并生成视频任务"
                        : "生成视频任务"}
                  </button>
                </div>
              </>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
