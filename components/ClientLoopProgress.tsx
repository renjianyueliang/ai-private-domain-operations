"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileText,
  FileVideo2,
  Inbox,
  PackageCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

type LoopStepKey = "plan" | "review" | "video" | "publish" | "inbox" | "crm";

type ClientLoopProgressProps = {
  tenantId: string;
  current?: LoopStepKey;
};

type ContentDraftView = {
  id: string;
  status: "needs_review" | "approved" | "rejected" | "video_queued";
};

type WorkflowVideoJobView = {
  id: string;
};

type PublishPlanView = {
  id: string;
};

type ConversationActionEventView = {
  id: string;
  action: "confirm_send" | "transfer_human" | "add_followup";
};

type LoopSnapshot = {
  planCount: number;
  draftCount: number;
  waitingDraftCount: number;
  approvedDraftCount: number;
  rejectedDraftCount: number;
  queuedDraftCount: number;
  videoCount: number;
  publishCount: number;
  conversationActionCount: number;
  followupCount: number;
};

const emptySnapshot: LoopSnapshot = {
  planCount: 0,
  draftCount: 0,
  waitingDraftCount: 0,
  approvedDraftCount: 0,
  rejectedDraftCount: 0,
  queuedDraftCount: 0,
  videoCount: 0,
  publishCount: 0,
  conversationActionCount: 0,
  followupCount: 0,
};

const stepMeta = [
  {
    key: "plan" as const,
    label: "获客计划",
    description: "确定行业、产品、人群和资料钩子",
    href: "/workspace/plan",
    icon: Sparkles,
  },
  {
    key: "review" as const,
    label: "内容审核",
    description: "审核 AI 草稿，确认可进入视频",
    href: "/workspace/review",
    icon: ClipboardCheck,
  },
  {
    key: "video" as const,
    label: "视频任务",
    description: "生成脚本、字幕、平台版本",
    href: "/workspace/video",
    icon: FileVideo2,
  },
  {
    key: "publish" as const,
    label: "发布包",
    description: "生成多平台素材包和排期清单",
    href: "/workspace/channels",
    icon: PackageCheck,
  },
  {
    key: "inbox" as const,
    label: "私信承接",
    description: "处理评论/私信和 AI 回复建议",
    href: "/workspace/inbox",
    icon: Inbox,
  },
  {
    key: "crm" as const,
    label: "CRM 跟进",
    description: "把有效咨询沉淀成下一步商机",
    href: "/workspace/crm",
    icon: UsersRound,
  },
];

function withTenant(href: string, tenantId: string) {
  return `${href}?tenant=${encodeURIComponent(tenantId)}`;
}

function getStepState(key: LoopStepKey, snapshot: LoopSnapshot) {
  if (key === "plan") return snapshot.planCount > 0 ? "done" : "current";
  if (key === "review") {
    if (snapshot.queuedDraftCount > 0 || snapshot.approvedDraftCount > 0) return "done";
    if (snapshot.draftCount > 0) return "current";
    return "locked";
  }
  if (key === "video") {
    if (snapshot.videoCount > 0) return "done";
    if (snapshot.queuedDraftCount > 0 || snapshot.approvedDraftCount > 0) return "current";
    return "locked";
  }
  if (key === "publish") {
    if (snapshot.publishCount > 0) return "done";
    if (snapshot.videoCount > 0) return "current";
    return "locked";
  }
  if (key === "inbox") {
    if (snapshot.conversationActionCount > 0) return "done";
    if (snapshot.publishCount > 0) return "current";
    return "locked";
  }
  if (snapshot.followupCount > 0) return "done";
  if (snapshot.conversationActionCount > 0) return "current";
  return "locked";
}

function getNextAction(snapshot: LoopSnapshot) {
  if (snapshot.planCount === 0) {
    return {
      label: "先生成获客计划",
      href: "/workspace/plan",
      copy: "客户先填行业、产品、客户和资料钩子。",
    };
  }
  if (snapshot.draftCount === 0 || snapshot.waitingDraftCount > 0) {
    return {
      label: "去审核内容草稿",
      href: "/workspace/review",
      copy: snapshot.waitingDraftCount > 0
        ? `${snapshot.waitingDraftCount} 条草稿等待人工确认。`
        : "获客计划已生成，下一步检查内容草稿。",
    };
  }
  if (snapshot.approvedDraftCount === 0 && snapshot.queuedDraftCount === 0) {
    return {
      label: "调整并重新生成",
      href: "/workspace/plan",
      copy: "首次人工判断已完成，当前草稿已驳回；调整目标或内容后再生成一版。",
    };
  }
  if (snapshot.videoCount === 0) {
    return {
      label: "生成视频任务",
      href: "/workspace/review",
      copy: "审核通过后，一键把脚本流转到视频任务。",
    };
  }
  if (snapshot.publishCount === 0) {
    return {
      label: "生成发布包",
      href: "/workspace/video",
      copy: "视频任务已就绪，下一步生成各平台素材包。",
    };
  }
  if (snapshot.conversationActionCount === 0) {
    return {
      label: "处理私信承接",
      href: "/workspace/inbox",
      copy: "发布包已生成，下一步处理咨询、回复建议和转人工。",
    };
  }
  return {
    label: "查看 CRM 跟进",
    href: "/workspace/crm",
    copy: "会话动作已记录，确认线索下一步和负责人。",
  };
}

function getFirstValueStatus(snapshot: LoopSnapshot) {
  if (snapshot.planCount === 0) return "第 1 步 / 共 3 步";
  if (snapshot.draftCount === 0) return "第 2 步 / 共 3 步";
  if (snapshot.waitingDraftCount > 0) return "第 3 步 / 共 3 步";
  if (snapshot.approvedDraftCount > 0 || snapshot.queuedDraftCount > 0) return "已完成人工审核";
  if (snapshot.rejectedDraftCount > 0) return "已完成人工驳回";
  return "状态待确认";
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "读取闭环状态失败。");
  return data as T;
}

export function ClientLoopProgress({ tenantId, current }: ClientLoopProgressProps) {
  const [snapshot, setSnapshot] = useState<LoopSnapshot>(emptySnapshot);
  const [message, setMessage] = useState("正在读取客户闭环状态...");

  useEffect(() => {
    let cancelled = false;

    async function loadLoop() {
      try {
        const query = `tenantId=${encodeURIComponent(tenantId)}`;
        const [plansData, draftsData, videosData, publishData, actionsData] = await Promise.all([
          fetchJson<{ acquisitionPlans?: unknown[] }>(`/api/workspace/acquisition-plans?${query}`),
          fetchJson<{ contentDrafts?: ContentDraftView[] }>(`/api/workspace/content-drafts?${query}`),
          fetchJson<{ videoJobs?: WorkflowVideoJobView[] }>(`/api/workspace/video-jobs?${query}`),
          fetchJson<{ publishPlans?: PublishPlanView[] }>(`/api/workspace/publish-plans?${query}`),
          fetchJson<{ conversationActions?: ConversationActionEventView[] }>(`/api/workspace/conversation-actions?${query}`),
        ]);

        if (cancelled) return;

        const drafts = Array.isArray(draftsData?.contentDrafts) ? draftsData.contentDrafts : [];
        const actions = Array.isArray(actionsData?.conversationActions) ? actionsData.conversationActions : [];
        const nextSnapshot: LoopSnapshot = {
          planCount: Array.isArray(plansData?.acquisitionPlans) ? plansData.acquisitionPlans.length : 0,
          draftCount: drafts.length,
          waitingDraftCount: drafts.filter((draft) => draft.status === "needs_review").length,
          approvedDraftCount: drafts.filter((draft) => draft.status === "approved").length,
          rejectedDraftCount: drafts.filter((draft) => draft.status === "rejected").length,
          queuedDraftCount: drafts.filter((draft) => draft.status === "video_queued").length,
          videoCount: Array.isArray(videosData?.videoJobs) ? videosData.videoJobs.length : 0,
          publishCount: Array.isArray(publishData?.publishPlans) ? publishData.publishPlans.length : 0,
          conversationActionCount: actions.length,
          followupCount: actions.filter((action) => action.action === "add_followup" || action.action === "transfer_human").length,
        };

        setSnapshot(nextSnapshot);
        setMessage("闭环状态已同步。");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取闭环状态失败。");
        }
      }
    }

    loadLoop();
    window.addEventListener("client-loop:changed", loadLoop);
    return () => {
      cancelled = true;
      window.removeEventListener("client-loop:changed", loadLoop);
    };
  }, [tenantId]);

  const nextAction = useMemo(() => getNextAction(snapshot), [snapshot]);
  const firstValueStatus = useMemo(() => getFirstValueStatus(snapshot), [snapshot]);

  return (
    <article className="client-loop-progress" aria-label="客户获客到成交闭环进度">
      <div className="client-loop-heading">
        <div>
          <div className="section-kicker">首次价值引导 <span>{firstValueStatus}</span></div>
          <h2>先完成计划、草稿和人工审核，再进入后续闭环</h2>
          <p>{nextAction.copy}</p>
        </div>
        <a className="primary-button" href={withTenant(nextAction.href, tenantId)}>
          {nextAction.label}
        </a>
      </div>

      <div className="client-loop-steps">
        {stepMeta.map((step, index) => {
          const Icon = step.icon;
          const state = getStepState(step.key, snapshot);
          const isCurrent = step.key === current;
          return (
            <a
              key={step.key}
              href={withTenant(step.href, tenantId)}
              className={`${state} ${isCurrent ? "active" : ""}`}
            >
              <span className="client-loop-index">
                {state === "done" ? <CheckCircle2 size={15} /> : <CircleDot size={15} />}
              </span>
              <Icon size={17} aria-hidden="true" />
              <strong>{index + 1}. {step.label}</strong>
              <small>{step.description}</small>
            </a>
          );
        })}
      </div>

      <div className="client-loop-stats" role="status">
        <span><FileText size={14} />计划 {snapshot.planCount}</span>
        <span><ClipboardCheck size={14} />待审 {snapshot.waitingDraftCount}</span>
        <span><FileVideo2 size={14} />视频 {snapshot.videoCount}</span>
        <span><PackageCheck size={14} />发布包 {snapshot.publishCount}</span>
        <span><Inbox size={14} />动作 {snapshot.conversationActionCount}</span>
        <em>{message}</em>
      </div>
    </article>
  );
}
