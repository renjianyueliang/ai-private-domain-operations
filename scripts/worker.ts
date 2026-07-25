import { Worker } from "bullmq";
import { demoUsers } from "../lib/auth";
import { runQueuedJobs } from "../lib/job-worker";

const redisUrl = process.env.REDIS_URL?.trim();
const queueName = process.env.WORKER_QUEUE_NAME?.trim() || "ai-saas-jobs";

if (!redisUrl) {
  console.error("REDIS_URL is required to start the BullMQ worker.");
  process.exit(1);
}

const workerUser = demoUsers.find((user) => user.id === "user-platform-admin") ?? demoUsers[0];

const worker = new Worker<{ tenantId: string; jobId: string }>(
  queueName,
  async (job) => {
    const { tenantId } = job.data;
    if (!tenantId) {
      throw new Error("tenantId is required.");
    }

    const result = await runQueuedJobs(tenantId, workerUser, 1);
    return {
      processed: result.processed,
      skipped: result.skipped,
    };
  },
  {
    connection: { url: redisUrl },
    concurrency: Number.parseInt(process.env.WORKER_CONCURRENCY ?? "3", 10),
  },
);

worker.on("completed", (job, result) => {
  console.log(JSON.stringify({ event: "completed", jobId: job.id, result }));
});

worker.on("failed", (job, error) => {
  console.error(JSON.stringify({ event: "failed", jobId: job?.id, error: error.message }));
});

console.log(JSON.stringify({ worker: "started", queueName }));
