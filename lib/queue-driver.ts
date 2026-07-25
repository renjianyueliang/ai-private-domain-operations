import { Queue } from "bullmq";

type QueuePayload = {
  tenantId: string;
  jobId: string;
};

const globalForQueue = globalThis as unknown as {
  aiSaasQueue?: Queue<QueuePayload>;
};

export type QueueBackend = "local-api" | "bullmq";

export function getQueueBackend(): QueueBackend {
  return process.env.REDIS_URL?.trim() ? "bullmq" : "local-api";
}

export function getQueueStatus() {
  const backend = getQueueBackend();
  return {
    backend,
    configured: backend === "bullmq",
    queueName: process.env.WORKER_QUEUE_NAME?.trim() || "ai-saas-jobs",
    note:
      backend === "bullmq"
        ? "Redis 已配置，可使用 BullMQ 常驻 Worker。"
        : "未配置 REDIS_URL，当前使用 API 触发式本地队列。",
  };
}

function getBullQueue() {
  if (!process.env.REDIS_URL?.trim()) {
    throw new Error("REDIS_URL is not configured.");
  }

  if (!globalForQueue.aiSaasQueue) {
    globalForQueue.aiSaasQueue = new Queue<QueuePayload>(
      process.env.WORKER_QUEUE_NAME?.trim() || "ai-saas-jobs",
      { connection: { url: process.env.REDIS_URL.trim() } },
    );
  }

  return globalForQueue.aiSaasQueue;
}

export async function enqueueWorkerJob(payload: QueuePayload) {
  if (getQueueBackend() === "local-api") {
    return {
      backend: "local-api" as const,
      enqueued: false,
      reason: "未配置 REDIS_URL，任务保留在本地队列，等待 /api/jobs/run 触发。",
    };
  }

  const job = await getBullQueue().add("process-job", payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });

  return {
    backend: "bullmq" as const,
    enqueued: true,
    jobId: job.id,
  };
}
