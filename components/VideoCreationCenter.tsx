"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Captions,
  CheckCircle2,
  Download,
  FileVideo2,
  Scissors,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { getVideoJobsForTenant } from "../lib/workspace-product";
import { getTenantById } from "../lib/saas";
import { ClientLoopProgress } from "./ClientLoopProgress";

type VideoCreationCenterProps = {
  tenantId: string;
};

type WorkflowVideoJobView = {
  id: string;
  contentDraftId?: string;
  title: string;
  sourceTitle: string;
  script: string;
  stage: "脚本" | "剪辑" | "字幕" | "审核" | "待发布";
  platformVersions: Array<{
    platform: string;
    ratio: string;
    duration: string;
    status: string;
  }>;
  safetyNotes: string[];
  createdAt: string;
};

type DisplayVideoJob = {
  id: string;
  title: string;
  source: string;
  stage: "脚本" | "剪辑" | "字幕" | "审核" | "待发布";
  duration: string;
  versions: Array<{ platform: string; ratio: string; duration: string; status: string }>;
  scriptHook: string;
  coverTitle: string;
  subtitleStatus: string;
  safetyNotes: string[];
  persisted: boolean;
};

function workflowToDisplayJob(job: WorkflowVideoJobView): DisplayVideoJob {
  const firstLine = job.script.split("\n").find(Boolean) ?? "已生成脚本，等待剪辑。";
  const firstVersion = job.platformVersions[0];
  return {
    id: job.id,
    title: job.title,
    source: job.sourceTitle,
    stage: job.stage,
    duration: firstVersion?.duration ?? "30-60 秒",
    versions: job.platformVersions,
    scriptHook: firstLine.replace(/^开场：/, ""),
    coverTitle: job.title.slice(0, 16),
    subtitleStatus: "已根据脚本生成字幕结构，等待人工校对与真实转码。",
    safetyNotes: job.safetyNotes,
    persisted: true,
  };
}

export function VideoCreationCenter({ tenantId }: VideoCreationCenterProps) {
  const tenant = getTenantById(tenantId);
  const demoJobs = useMemo<DisplayVideoJob[]>(
    () => getVideoJobsForTenant(tenant.id).map((job) => ({ ...job, persisted: false })),
    [tenant.id],
  );
  const [workflowJobs, setWorkflowJobs] = useState<WorkflowVideoJobView[]>([]);
  const [message, setMessage] = useState("读取视频任务中...");
  const [isSaving, setIsSaving] = useState(false);
  const jobs = useMemo(
    () => [...workflowJobs.map(workflowToDisplayJob), ...demoJobs],
    [workflowJobs, demoJobs],
  );
  const [selectedId, setSelectedId] = useState(jobs[0]?.id);
  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0];
  const tenantQuery = `?tenant=${encodeURIComponent(tenant.id)}`;

  async function loadWorkflowJobs() {
    try {
      const response = await fetch(`/api/workspace/video-jobs?tenantId=${encodeURIComponent(tenant.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "读取视频任务失败。");
      const nextJobs: WorkflowVideoJobView[] = Array.isArray(data.videoJobs) ? data.videoJobs : [];
      setWorkflowJobs(nextJobs);
      if (nextJobs[0]) {
        setSelectedId((current) =>
          current && nextJobs.some((job) => job.id === current) ? current : nextJobs[0].id,
        );
      }
      setMessage(`已载入 ${nextJobs.length} 个真实流转任务，存储模式：${data.storageMode}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取视频任务失败。");
    }
  }

  useEffect(() => {
    loadWorkflowJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  useEffect(() => {
    if (!selectedId && jobs[0]) setSelectedId(jobs[0].id);
  }, [jobs, selectedId]);

  async function createPublishPlan() {
    if (!selected || !selected.persisted || isSaving) return;
    setIsSaving(true);
    setMessage("正在生成发布包...");
    try {
      const response = await fetch("/api/workspace/publish-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          videoJobId: selected.id,
          platform: "YouTube Shorts / 抖音素材包",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "生成发布包失败。");
      setMessage(`已生成发布包：${data.record.platform} · ${data.record.status}。下一步到发布中心确认素材包。`);
      window.dispatchEvent(new CustomEvent("client-loop:changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成发布包失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="workspace-page-shell" aria-label="视频创作中心">
      <div className="workspace-page-hero">
        <div>
          <div className="section-kicker">视频创作中心 <span>新增</span></div>
          <h1>从原始素材到多平台短视频版本</h1>
          <p>{tenant.name} 的视频任务会经过脚本、剪辑、字幕、封面、平台适配和合规审核。</p>
        </div>
        <a className="primary-button" href={`/workspace/foundation${tenantQuery}`}>
          <Upload size={17} />
          上传素材
        </a>
      </div>

      <div className="model-save-banner" role="status">
        <CheckCircle2 size={16} />
        {message}
      </div>

      <ClientLoopProgress tenantId={tenant.id} current="video" />

      <div className="video-center-layout">
        <aside className="video-job-selector">
          <div className="panel-heading compact">
            <span>视频任务</span>
            <small>{jobs.length} 个处理中</small>
          </div>
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              className={job.id === selected.id ? "active" : ""}
              onClick={() => setSelectedId(job.id)}
            >
              <FileVideo2 size={17} />
              <div>
                <strong>{job.title}</strong>
                <small>{job.stage} · {job.duration} · {job.persisted ? "真实任务" : "演示样例"}</small>
              </div>
            </button>
          ))}
        </aside>

        <article className="video-workbench">
          <div className="video-preview-frame">
            <span>9:16</span>
            <strong>{selected.coverTitle}</strong>
            <small>{selected.duration}</small>
          </div>
          <div className="video-workbench-copy">
            <div className="panel-heading compact">
              <span>{selected.title}</span>
              <small>来源：{selected.source}</small>
            </div>
            <div className="script-card">
              <Scissors size={17} />
              <div>
                <strong>开场钩子</strong>
                <p>{selected.scriptHook}</p>
              </div>
            </div>
            <div className="script-card">
              <Captions size={17} />
              <div>
                <strong>字幕状态</strong>
                <p>{selected.subtitleStatus}</p>
              </div>
            </div>
            <div className="script-card">
              <ShieldCheck size={17} />
              <div>
                <strong>合规检查</strong>
                <ul>
                  {selected.safetyNotes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
            </div>
            <div className="video-action-row">
              <button
                type="button"
                className="primary-button"
                onClick={createPublishPlan}
                disabled={!selected.persisted || isSaving}
              >
                <Download size={16} />
                {selected.persisted ? (isSaving ? "生成中" : "生成发布包") : "演示任务不可发布"}
              </button>
              <a className="secondary-button" href={`/workspace/channels${tenantQuery}`}>
                查看发布中心
              </a>
            </div>
          </div>
        </article>

        <aside className="platform-version-panel">
          <div className="panel-heading compact">
            <span>平台版本</span>
            <small>尺寸 / 时长 / 状态</small>
          </div>
          {selected.versions.map((version) => (
            <div key={`${version.platform}-${version.ratio}`} className="platform-version-row">
              <CheckCircle2 size={16} />
              <div>
                <strong>{version.platform}</strong>
                <span>{version.ratio} · {version.duration}</span>
              </div>
              <em>{version.status}</em>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
