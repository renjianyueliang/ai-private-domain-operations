"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  PackageCheck,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import { getTenantById } from "../lib/saas";
import { getTenantOperations } from "../lib/operations";
import { ClientLoopProgress } from "./ClientLoopProgress";

type WorkflowVideoJobView = {
  id: string;
  title: string;
  sourceTitle: string;
  stage: string;
  platformVersions: Array<{
    platform: string;
    ratio: string;
    duration: string;
    status: string;
  }>;
};

type PublishPlanView = {
  id: string;
  videoJobId?: string;
  platform: string;
  mode: "官方API" | "素材包" | "人工确认" | "半自动";
  title: string;
  status: "素材包就绪" | "待审核" | "已排期";
  scheduledAt?: string;
  packageChecklist: string[];
  createdAt: string;
};

type ClientPublishCenterProps = {
  tenantId: string;
};

const platformOptions = [
  "YouTube Shorts",
  "TikTok 素材包",
  "抖音素材包",
  "小红书素材包",
  "快手素材包",
  "视频号素材包",
  "Telegram 频道",
];

function formatTime(value?: string) {
  if (!value) return "未排期";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ClientPublishCenter({ tenantId }: ClientPublishCenterProps) {
  const tenant = getTenantById(tenantId);
  const operations = useMemo(() => getTenantOperations(tenant.id), [tenant.id]);
  const [videoJobs, setVideoJobs] = useState<WorkflowVideoJobView[]>([]);
  const [publishPlans, setPublishPlans] = useState<PublishPlanView[]>([]);
  const [selectedVideoJobId, setSelectedVideoJobId] = useState<string>();
  const [selectedPlatform, setSelectedPlatform] = useState(platformOptions[0]);
  const [message, setMessage] = useState("读取发布数据中...");
  const [isSaving, setIsSaving] = useState(false);
  const tenantQuery = `?tenant=${encodeURIComponent(tenant.id)}`;

  async function loadData() {
    try {
      const [videoResponse, publishResponse] = await Promise.all([
        fetch(`/api/workspace/video-jobs?tenantId=${encodeURIComponent(tenant.id)}`),
        fetch(`/api/workspace/publish-plans?tenantId=${encodeURIComponent(tenant.id)}`),
      ]);
      const videoData = await videoResponse.json();
      const publishData = await publishResponse.json();
      if (!videoResponse.ok) throw new Error(videoData.error ?? "读取视频任务失败。");
      if (!publishResponse.ok) throw new Error(publishData.error ?? "读取发布计划失败。");

      const nextVideoJobs: WorkflowVideoJobView[] = Array.isArray(videoData.videoJobs) ? videoData.videoJobs : [];
      const nextPublishPlans = Array.isArray(publishData.publishPlans) ? publishData.publishPlans : [];
      setVideoJobs(nextVideoJobs);
      setPublishPlans(nextPublishPlans);
      setSelectedVideoJobId((current) =>
        current && nextVideoJobs.some((job) => job.id === current) ? current : nextVideoJobs[0]?.id,
      );
      setMessage(`已载入 ${nextPublishPlans.length} 个发布包，存储模式：${publishData.storageMode}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取发布数据失败。");
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

  const selectedVideoJob = videoJobs.find((job) => job.id === selectedVideoJobId) ?? videoJobs[0];
  const connectedCount = tenant.channels.filter((channel) => channel.status === "connected").length;
  const allPublishPlans: PublishPlanView[] = [
    ...publishPlans,
    ...operations.publishPlans.map((plan, index) => ({
      id: `${tenant.id}-static-${index}`,
      platform: plan.platform,
      mode: plan.mode,
      title: plan.requirement,
      status: plan.status === "connected" ? "待审核" : "素材包就绪",
      scheduledAt: undefined,
      packageChecklist: [plan.requirement, plan.nextAction, "人工确认后执行"],
      createdAt: new Date().toISOString(),
    } satisfies PublishPlanView)),
  ];

  async function createPublishPlan() {
    if (!selectedVideoJob || isSaving) return;
    setIsSaving(true);
    setMessage("正在生成发布包...");
    try {
      const response = await fetch("/api/workspace/publish-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          videoJobId: selectedVideoJob.id,
          platform: selectedPlatform,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "生成发布包失败。");
      await loadData();
      setMessage(`已生成 ${data.record.platform} 发布包：${data.record.status}。下一步进入私信聚合，处理咨询承接。`);
      window.dispatchEvent(new CustomEvent("client-loop:changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成发布包失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="workspace-page-shell client-publish-center" aria-label="发布包与渠道中心">
      <div className="workspace-page-hero">
        <div>
          <div className="section-kicker">发布包与渠道中心 <span>可操作</span></div>
          <h1>按平台生成发布包，授权后再进入自动发布</h1>
          <p>
            本地版先把标题、字幕、封面、引流文案、合规提示和人工确认清单生成出来。
            接入官方 API 后，这里可升级成排期发布队列。
          </p>
        </div>
        <a className="secondary-button" href={`/workspace/video${tenantQuery}`}>
          <PackageCheck size={17} />
          查看视频任务
        </a>
      </div>

      <div className="publish-channel-grid">
        <article>
          <PlugZap size={18} />
          <span>已连接渠道</span>
          <strong>{connectedCount}</strong>
          <small>来自客户授权</small>
        </article>
        <article>
          <ClipboardList size={18} />
          <span>素材包</span>
          <strong>{publishPlans.length}</strong>
          <small>本地已生成</small>
        </article>
        <article>
          <ShieldCheck size={18} />
          <span>发布边界</span>
          <strong>人工确认</strong>
          <small>保护账号合规</small>
        </article>
      </div>

      <div className="model-save-banner" role="status">
        <CheckCircle2 size={16} />
        {message}
      </div>

      <ClientLoopProgress tenantId={tenant.id} current="publish" />

      <div className="publish-workflow-layout">
        <article className="publish-builder-card">
          <div className="panel-heading compact">
            <span>从视频任务生成发布包</span>
            <small>一个任务可生成多个平台版本</small>
          </div>
          {videoJobs.length === 0 ? (
            <div className="empty-client-state compact">
              <PackageCheck size={20} />
              <strong>还没有可用视频任务</strong>
              <p>先在“内容审核中心”把草稿流转到视频任务，再回到这里生成发布包。</p>
              <a className="primary-button" href={`/workspace/review${tenantQuery}`}>去审核内容</a>
            </div>
          ) : (
            <>
              <label>
                选择视频任务
                <select
                  value={selectedVideoJob?.id}
                  onChange={(event) => setSelectedVideoJobId(event.target.value)}
                >
                  {videoJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                发布平台/方式
                <select
                  value={selectedPlatform}
                  onChange={(event) => setSelectedPlatform(event.target.value)}
                >
                  {platformOptions.map((platform) => (
                    <option key={platform}>{platform}</option>
                  ))}
                </select>
              </label>
              {selectedVideoJob && (
                <div className="selected-video-summary">
                  <strong>{selectedVideoJob.title}</strong>
                  <span>来源：{selectedVideoJob.sourceTitle} · 阶段：{selectedVideoJob.stage}</span>
                  <div>
                    {selectedVideoJob.platformVersions.map((version) => (
                      <small key={`${version.platform}-${version.ratio}`}>
                        {version.platform} · {version.ratio} · {version.duration}
                      </small>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" className="primary-button" onClick={createPublishPlan} disabled={isSaving}>
                <Download size={16} />
                {isSaving ? "生成中" : "生成发布包"}
              </button>
            </>
          )}
        </article>

        <article className="publish-channel-card">
          <div className="panel-heading compact">
            <span>客户渠道授权状态</span>
            <small>真实发布需要官方授权</small>
          </div>
          <div className="publish-channel-list">
            {tenant.channels.map((channel) => (
              <div key={channel.name} className={`status-item ${channel.status}`}>
                <strong>{channel.name}</strong>
                <span>{channel.description}</span>
              </div>
            ))}
          </div>
          <div className="publish-boundary-note">
            不连接真实平台时，系统只生成素材包；连接 YouTube、Telegram、企业微信等官方能力后，
            才能进入自动排期或消息承接。
          </div>
          <a className="primary-button publish-next-button" href={`/workspace/inbox${tenantQuery}`}>
            进入私信聚合处理咨询
          </a>
        </article>
      </div>

      <div className="publish-plan-grid">
        {allPublishPlans.map((plan) => (
          <article key={plan.id} className="publish-plan-record-card">
            <div className="publish-plan-card-heading">
              <span className={`draft-status-badge ${plan.status === "已排期" ? "video_queued" : "approved"}`}>
                {plan.status}
              </span>
              <strong>{plan.platform}</strong>
              <small>{plan.mode} · {formatTime(plan.scheduledAt ?? plan.createdAt)}</small>
            </div>
            <p>{plan.title}</p>
            <ul>
              {plan.packageChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="publish-plan-footer">
              <CalendarClock size={15} />
              <span>{plan.mode === "官方API" ? "授权后可进入排期" : "导出给人工发布"}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
