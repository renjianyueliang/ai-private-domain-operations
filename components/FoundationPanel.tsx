"use client";

import { useEffect, useMemo, useState } from "react";
import { canWriteTenantData, demoUsers, roleLabels } from "../lib/auth";

type StoredUploadView = {
  id: string;
  kind: "knowledge" | "video";
  originalName: string;
  mimeType: string;
  size: number;
  status: string;
  uploadedBy: string;
  createdAt: string;
};

type QueueJobView = {
  id: string;
  kind: string;
  title: string;
  status: string;
  createdBy: string;
  createdAt: string;
  logs: string[];
};

type KnowledgeSourceView = {
  uploadId: string;
  jobId?: string;
  title: string;
  fileName: string;
  status: string;
  summary: string;
  extractedPreview?: string;
  keywords: string[];
  chunks: Array<{
    id: string;
    title: string;
    text: string;
  }>;
  indexedChunks?: number;
  canUseForAi: boolean;
  updatedAt: string;
};

type AuditLogView = {
  id: string;
  actor: string;
  action: string;
  createdAt: string;
};

type WorkspaceState = {
  storageMode: "local" | "postgres";
  uploads: StoredUploadView[];
  jobs: QueueJobView[];
  knowledgeSources: KnowledgeSourceView[];
  auditLogs: AuditLogView[];
};

type FeatureAccessView = {
  allowed: boolean;
  reason: string;
};

type FoundationPanelProps = {
  tenantId: string;
  tenantName: string;
  knowledgeAccess: FeatureAccessView;
  videoAccess: FeatureAccessView;
};

const emptyState: WorkspaceState = {
  storageMode: "local",
  uploads: [],
  jobs: [],
  knowledgeSources: [],
  auditLogs: [],
};

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "排队中",
    running: "执行中",
    needs_review: "需审核",
    done: "已完成",
    failed: "失败",
    uploaded: "已上传",
    processed: "已处理",
    blocked: "已阻断",
  };
  return labels[status] ?? status;
}

export function FoundationPanel({
  tenantId,
  tenantName,
  knowledgeAccess,
  videoAccess,
}: FoundationPanelProps) {
  const [selectedUserId, setSelectedUserId] = useState("user-tenant-admin");
  const [state, setState] = useState<WorkspaceState>(emptyState);
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [message, setMessage] = useState("等待上传知识库或视频素材。");
  const [isLoading, setIsLoading] = useState(false);

  const selectedUser = useMemo(
    () => demoUsers.find((user) => user.id === selectedUserId) ?? demoUsers[1],
    [selectedUserId],
  );
  const canUpload = canWriteTenantData(selectedUser, tenantId);
  const canUploadKnowledge = canUpload && knowledgeAccess.allowed;
  const canUploadVideo = canUpload && videoAccess.allowed;

  async function refreshState() {
    const response = await fetch(`/api/workspace-state?tenantId=${tenantId}`, {
      headers: {
        "x-demo-user": selectedUserId,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "加载工作区状态失败。");
    }

    setState({
      storageMode: data.storageMode ?? "local",
      uploads: data.uploads ?? [],
      jobs: data.jobs ?? [],
      knowledgeSources: data.knowledgeSources ?? [],
      auditLogs: data.auditLogs ?? [],
    });
  }

  useEffect(() => {
    refreshState().catch((error) => {
      setMessage(error instanceof Error ? error.message : "加载工作区状态失败。");
    });
  }, [selectedUserId, tenantId]);

  async function uploadFile(kind: "knowledge" | "video") {
    const file = kind === "knowledge" ? knowledgeFile : videoFile;
    if (!file || isLoading) return;

    setIsLoading(true);
    setMessage(kind === "knowledge" ? "正在上传知识库文件..." : "正在上传视频素材...");

    try {
      const formData = new FormData();
      formData.append("tenantId", tenantId);
      formData.append("file", file);

      const response = await fetch(
        kind === "knowledge" ? "/api/uploads/knowledge" : "/api/uploads/video",
        {
          method: "POST",
          headers: {
            "x-demo-user": selectedUserId,
          },
          body: formData,
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "上传失败。");
      }

      setMessage(
        kind === "knowledge"
          ? "知识库已上传，并创建解析索引任务。"
          : "视频已上传，并创建转码、字幕和合规审核任务。",
      );
      if (kind === "knowledge") setKnowledgeFile(null);
      if (kind === "video") setVideoFile(null);
      await refreshState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function runQueue() {
    if (isLoading) return;

    setIsLoading(true);
    setMessage("正在执行队列任务...");

    try {
      const response = await fetch("/api/jobs/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-user": selectedUserId,
        },
        body: JSON.stringify({ tenantId, maxJobs: 5 }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "执行队列失败。");
      }

      setMessage(`已执行 ${data.processed} 个任务；需要外部服务或人工审核的任务会保留在待审核状态。`);
      await refreshState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行队列失败。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="foundation-panel" aria-label="SaaS 基础能力">
      <div className="section-heading-row">
        <div>
          <div className="section-kicker">第三版 SaaS 基础</div>
          <h2>真实上传、任务队列与权限演示</h2>
        </div>
        <p>
          当前客户：{tenantName}。文件会写入当前存储后端，
          同时生成任务队列和审计记录。当前后端：{state.storageMode === "postgres" ? "PostgreSQL" : "本地 .local-data"}。
        </p>
      </div>

      <div className="foundation-grid">
        <article className="foundation-card auth-card">
          <div className="panel-heading compact">
            <span>登录角色演示</span>
            <small>后续替换为真实登录</small>
          </div>
          <label htmlFor="demo-user">当前身份</label>
          <select
            id="demo-user"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            {demoUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {roleLabels[user.role]}
              </option>
            ))}
          </select>
          <div className={`permission-badge ${canUpload ? "ready" : "blocked"}`}>
            {canUpload ? "可上传 / 可创建任务" : "只读权限，不能上传"}
          </div>
          <div className={`permission-badge ${knowledgeAccess.allowed ? "ready" : "blocked"}`}>
            知识库：{knowledgeAccess.allowed ? "已开通" : knowledgeAccess.reason}
          </div>
          <div className={`permission-badge ${videoAccess.allowed ? "ready" : "blocked"}`}>
            视频工厂：{videoAccess.allowed ? "已开通" : videoAccess.reason}
          </div>
          <p>{selectedUser.email}</p>
        </article>

        <article className="foundation-card upload-card">
          <div className="panel-heading compact">
            <span>知识库上传</span>
            <small>PDF / Word / TXT / Markdown</small>
          </div>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.csv,application/pdf,text/plain"
            disabled={!canUploadKnowledge || isLoading}
            onChange={(event) => setKnowledgeFile(event.target.files?.[0] ?? null)}
          />
          <p>
            上传后会创建“知识库解析任务”。生产环境会抽取文本、切分段落、向量化并绑定到当前客户知识库。
          </p>
          {!knowledgeAccess.allowed && <p className="blocked-copy">{knowledgeAccess.reason}</p>}
          <button
            type="button"
            className="secondary-button"
            disabled={!knowledgeFile || !canUploadKnowledge || isLoading}
            onClick={() => uploadFile("knowledge")}
          >
            上传知识库并建索引
          </button>
        </article>

        <article className="foundation-card upload-card">
          <div className="panel-heading compact">
            <span>视频上传</span>
            <small>原始素材 / 直播回放 / 口播视频</small>
          </div>
          <input
            type="file"
            accept="video/*"
            disabled={!canUploadVideo || isLoading}
            onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
          />
          <p>
            上传后会创建“转码、字幕、合规审核”三类任务。生产环境会导出 9:16、16:9、1:1 等平台版本。
          </p>
          {!videoAccess.allowed && <p className="blocked-copy">{videoAccess.reason}</p>}
          <button
            type="button"
            className="secondary-button"
            disabled={!videoFile || !canUploadVideo || isLoading}
            onClick={() => uploadFile("video")}
          >
            上传视频并创建任务
          </button>
        </article>
      </div>

      <div className="foundation-message" role="status">
        {message}
        <button
          type="button"
          className="secondary-button compact-action"
          disabled={isLoading || !canUpload || state.jobs.every((job) => job.status !== "queued")}
          onClick={runQueue}
        >
          执行队列
        </button>
      </div>

      <div className="foundation-state-grid">
        <article className="foundation-card knowledge-preview-card">
          <div className="panel-heading compact">
            <span>知识库解析预览</span>
            <small>{state.knowledgeSources.filter((source) => source.canUseForAi).length} 个可引用</small>
          </div>
          <div className="foundation-list">
            {state.knowledgeSources.length === 0 ? (
              <p>暂无知识库解析结果。上传 TXT/MD/CSV/JSON 后点击“执行队列”即可生成预览。</p>
            ) : (
              state.knowledgeSources.slice(0, 4).map((source) => (
                <div key={source.uploadId} className="knowledge-source-card">
                  <div className="knowledge-source-heading">
                    <strong>{source.title}</strong>
                    <em className={source.canUseForAi ? "ready" : "review"}>
                      {source.canUseForAi ? "可被 AI 引用" : statusLabel(source.status)}
                    </em>
                  </div>
                  <p>{source.summary}</p>
                  {source.keywords.length > 0 && (
                    <div className="knowledge-keyword-row">
                      {source.keywords.slice(0, 8).map((keyword) => (
                        <span key={keyword}>{keyword}</span>
                      ))}
                    </div>
                  )}
                  {source.chunks.slice(0, 2).map((chunk) => (
                    <blockquote key={chunk.id}>
                      <strong>{chunk.title}</strong>
                      <span>{chunk.text}</span>
                    </blockquote>
                  ))}
                  {source.extractedPreview && source.chunks.length === 0 && (
                    <blockquote>
                      <strong>文本预览</strong>
                      <span>{source.extractedPreview}</span>
                    </blockquote>
                  )}
                </div>
              ))
            )}
          </div>
        </article>

        <article className="foundation-card">
          <div className="panel-heading compact">
            <span>最近上传</span>
            <small>{state.uploads.length} 个文件</small>
          </div>
          <div className="foundation-list">
            {state.uploads.length === 0 ? (
              <p>暂无本地上传文件。</p>
            ) : (
              state.uploads.slice(0, 5).map((upload) => (
                <div key={upload.id} className="foundation-list-item">
                  <strong>{upload.originalName}</strong>
                  <span>
                    {upload.kind === "knowledge" ? "知识库" : "视频"} · {formatSize(upload.size)} · {statusLabel(upload.status)}
                  </span>
                  <small>{upload.uploadedBy}</small>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="foundation-card">
          <div className="panel-heading compact">
            <span>任务队列</span>
            <small>{state.jobs.length} 个任务</small>
          </div>
          <div className="foundation-list">
            {state.jobs.length === 0 ? (
              <p>暂无任务。上传知识库或视频后会自动生成。</p>
            ) : (
              state.jobs.slice(0, 6).map((job) => (
                <div key={job.id} className="foundation-list-item">
                  <strong>{job.title}</strong>
                  <span>{job.kind} · {statusLabel(job.status)}</span>
                  <small>{job.logs[0]}</small>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="foundation-card">
          <div className="panel-heading compact">
            <span>审计日志</span>
            <small>{state.auditLogs.length} 条记录</small>
          </div>
          <div className="foundation-list">
            {state.auditLogs.length === 0 ? (
              <p>暂无审计记录。</p>
            ) : (
              state.auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="foundation-list-item">
                  <strong>{log.action}</strong>
                  <span>{log.actor}</span>
                  <small>{new Date(log.createdAt).toLocaleString("zh-CN")}</small>
                </div>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
