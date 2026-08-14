import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { canWriteTenantData, type DemoUser } from "./auth";
import { getLocalDataRoot } from "./local-data-path";
import { readSnapshot, updateJob, type QueueJob, type StoredUpload } from "./local-store";
import { findTenantById } from "./saas";

export type WorkerResult = {
  processed: number;
  skipped: number;
  jobs: QueueJob[];
};

const videoVariants = [
  { platform: "TikTok/抖音/快手", ratio: "9:16", maxDuration: "15-60 秒", status: "待真实转码" },
  { platform: "YouTube Shorts/视频号", ratio: "9:16", maxDuration: "60 秒以内", status: "待真实转码" },
  { platform: "YouTube 横版", ratio: "16:9", maxDuration: "按客户频道策略", status: "待真实转码" },
  { platform: "小红书图文/视频封面", ratio: "1:1", maxDuration: "封面与笔记素材", status: "待真实导出" },
];

function localDataRoot() {
  return getLocalDataRoot();
}

function resolveUploadPath(upload: StoredUpload) {
  return path.join(localDataRoot(), upload.relativePath);
}

function normalizePreview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 600);
}

function splitKnowledgeChunks(text: string) {
  const paragraphs = text
    .split(/\n{2,}|(?<=。)|(?<=！)|(?<=？)/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 12)
    .slice(0, 8);

  return paragraphs.map((paragraph, index) => ({
    id: `chunk-${String(index + 1).padStart(2, "0")}`,
    title: `资料片段 ${index + 1}`,
    text: paragraph.slice(0, 260),
  }));
}

function extractKeywords(text: string) {
  const stopWords = new Set([
    "我们",
    "客户",
    "这个",
    "可以",
    "需要",
    "进行",
    "一个",
    "以及",
    "通过",
    "如果",
    "不是",
    "当前",
    "系统",
  ]);
  const matches = text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}/g) ?? [];
  const counts = new Map<string, number>();

  matches.forEach((word) => {
    if (stopWords.has(word) || /^\d+$/.test(word)) return;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function buildKnowledgeSummary(text: string, fileName: string) {
  const preview = normalizePreview(text);
  if (!preview) return `${fileName} 暂未抽取到有效文本。`;
  return `已从《${fileName}》抽取 ${text.length.toLocaleString("zh-CN")} 个字符，可作为内容生成和回复建议的引用来源。`;
}

async function processKnowledgeJob(job: QueueJob, upload?: StoredUpload) {
  const logs = [...job.logs, "Worker 已领取知识库解析任务。"];
  const payload = { ...job.payload };

  if (!upload) {
    logs.push("未找到关联上传文件，任务已失败。");
    await updateJob(job.tenantId, job.id, { status: "failed", logs, payload });
    return;
  }

  const lowerName = upload.originalName.toLowerCase();
  const canReadAsText =
    upload.mimeType.startsWith("text/") ||
    [".txt", ".md", ".csv", ".json"].some((extension) => lowerName.endsWith(extension));

  if (canReadAsText) {
    try {
      const raw = await readFile(resolveUploadPath(upload), "utf8");
      payload.extractedPreview = normalizePreview(raw) || "文件为空或暂未抽取到可用文本。";
      payload.indexedChunks = Math.max(1, Math.ceil(raw.length / 900));
      payload.knowledgePreview = {
        sourceFile: upload.originalName,
        summary: buildKnowledgeSummary(raw, upload.originalName),
        keywords: extractKeywords(raw),
        chunks: splitKnowledgeChunks(raw),
        extractedCharacters: raw.length,
      };
      logs.push("已完成基础文本抽取预览、关键词识别和知识片段生成。");
    } catch (error) {
      payload.extractionError = error instanceof Error ? error.message : "未知文本抽取错误";
      logs.push("文本抽取失败，已保留文件并等待人工检查。");
      await updateJob(job.tenantId, job.id, { status: "needs_review", logs, payload });
      return;
    }
  } else {
    payload.extractionMode = "pending-parser";
    logs.push("文件已入库。PDF/Word 解析需要服务器文档解析器，当前进入待处理状态。");
  }

  await updateJob(job.tenantId, job.id, { status: "done", logs, payload });
}

async function processVideoPlanJob(job: QueueJob, upload?: StoredUpload) {
  const logs = [...job.logs, "Worker 已领取视频任务。"];
  const payload: QueueJob["payload"] = {
    ...job.payload,
    variants: videoVariants,
    requiresRenderer: true,
    approvalRequired: true,
  };

  if (!upload) {
    logs.push("未找到关联视频文件，任务已失败。");
    await updateJob(job.tenantId, job.id, { status: "failed", logs, payload });
    return;
  }

  const outputDir = path.join(localDataRoot(), "processed", job.tenantId);
  const manifestPath = path.join(outputDir, `${job.id}.json`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        jobId: job.id,
        uploadId: upload.id,
        sourceFile: upload.originalName,
        variants: videoVariants,
        boundary: "当前生成平台规格清单；真实剪辑、字幕和转码需要后续接 FFmpeg/云媒体服务。",
      },
      null,
      2,
    ),
    "utf8",
  );

  payload.manifestPath = path.relative(localDataRoot(), manifestPath);
  logs.push("已生成多平台视频规格清单和处理清单，等待真实转码服务或人工审核。");
  await updateJob(job.tenantId, job.id, { status: "needs_review", logs, payload });
}

async function processComplianceJob(job: QueueJob) {
  const logs = [
    ...job.logs,
    "Worker 已完成规则检查占位处理。",
    "金融、医美、中医和交易教学内容仍需人工确认后才能对外发布。",
  ];
  await updateJob(job.tenantId, job.id, {
    status: "needs_review",
    logs,
    payload: { ...job.payload, approvalRequired: true },
  });
}

export async function runQueuedJobs(
  tenantId: string,
  user: DemoUser,
  maxJobs = 5,
): Promise<WorkerResult> {
  if (!findTenantById(tenantId)) {
    throw new Error("客户工作区不存在。");
  }

  if (!canWriteTenantData(user, tenantId)) {
    throw new Error("当前角色没有执行任务权限。");
  }

  const snapshot = await readSnapshot();
  const tenantUploads = snapshot.uploads.filter((upload) => upload.tenantId === tenantId);
  const queuedJobs = snapshot.jobs
    .filter((job) => job.tenantId === tenantId && job.status === "queued")
    .slice(0, maxJobs);

  for (const job of queuedJobs) {
    await updateJob(job.tenantId, job.id, {
      status: "running",
      logs: [...job.logs, "任务已开始执行。"],
    });

    const upload = job.uploadId
      ? tenantUploads.find((candidate) => candidate.id === job.uploadId)
      : undefined;

    if (job.kind === "knowledge_ingest") {
      await processKnowledgeJob(job, upload);
    } else if (job.kind === "video_transcode" || job.kind === "subtitle_generation") {
      await processVideoPlanJob(job, upload);
    } else if (job.kind === "compliance_review") {
      await processComplianceJob(job);
    } else {
      await updateJob(job.tenantId, job.id, {
        status: "failed",
        logs: [...job.logs, `暂不支持的任务类型：${job.kind}`],
      });
    }
  }

  const nextSnapshot = await readSnapshot();
  return {
    processed: queuedJobs.length,
    skipped: Math.max(0, snapshot.jobs.filter((job) => job.tenantId === tenantId).length - queuedJobs.length),
    jobs: nextSnapshot.jobs.filter((job) => job.tenantId === tenantId),
  };
}
