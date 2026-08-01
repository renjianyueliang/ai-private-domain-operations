import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getLocalDataRoot } from "./local-data-path";

export type StorageBackend = "local" | "s3-compatible";

export type StoredObject = {
  backend: StorageBackend;
  key: string;
  relativePath: string;
  absolutePath?: string;
  publicUrl?: string;
};

export function getStorageBackend(): StorageBackend {
  return process.env.OBJECT_STORAGE_ENDPOINT?.trim() &&
    process.env.OBJECT_STORAGE_BUCKET?.trim() &&
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim() &&
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim()
    ? "s3-compatible"
    : "local";
}

export function getObjectStorageStatus() {
  const backend = getStorageBackend();
  return {
    backend,
    configured: backend === "s3-compatible",
    bucket: process.env.OBJECT_STORAGE_BUCKET?.trim() || "local",
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT?.trim() || "",
    note:
      backend === "s3-compatible"
        ? "对象存储凭证已配置；生产 Worker 可切换到 S3/R2/OSS 适配器。"
        : "未配置对象存储，当前保存到本地 .local-data。",
  };
}

function localDataRoot() {
  return getLocalDataRoot();
}

export async function saveObject(key: string, file: File): Promise<StoredObject> {
  const backend = getStorageBackend();
  const relativePath = key.replace(/\\/g, "/");
  const absolutePath = path.join(localDataRoot(), relativePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (backend === "s3-compatible") {
    // The runtime keeps local mirroring until a concrete S3/R2/OSS SDK adapter
    // is enabled. This preserves one storage contract without pretending the
    // upload reached a customer bucket.
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);
    return {
      backend,
      key: relativePath,
      relativePath,
      absolutePath,
    };
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  return {
    backend: "local",
    key: relativePath,
    relativePath,
    absolutePath,
  };
}
