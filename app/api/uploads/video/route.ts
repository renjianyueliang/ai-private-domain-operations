import { NextResponse } from "next/server";
import {
  assertStorageAvailable,
  assertTenantFeature,
  assertVideoJobQuota,
} from "../../../../lib/entitlements";
import { createVideoPipelineJobs, saveUpload } from "../../../../lib/local-store";
import { getUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

const maxVideoBytes = 500 * 1024 * 1024;
const allowedVideoExtensions = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"];

function looksLikeVideo(file: File) {
  const lowerName = file.name.toLowerCase();
  return (
    file.type.startsWith("video/") ||
    allowedVideoExtensions.some((extension) => lowerName.endsWith(extension))
  );
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const formData = await request.formData();
    const tenantId = String(formData.get("tenantId") ?? "");
    const file = formData.get("file");

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    if (file.size > maxVideoBytes) {
      return NextResponse.json(
        { error: "视频文件当前限制 500MB 以内。" },
        { status: 413 },
      );
    }

    if (!looksLikeVideo(file)) {
      return NextResponse.json(
        { error: "请上传 mp4、mov、webm、mkv、avi、m4v 等视频文件。" },
        { status: 415 },
      );
    }

    const tenant = assertTenantFeature(tenantId, "video_factory");
    assertVideoJobQuota(tenant);
    assertStorageAvailable(tenant, file.size);

    const upload = await saveUpload(tenantId, "video", file, user);
    const jobs = await createVideoPipelineJobs(tenantId, upload, user);

    return NextResponse.json({ upload, jobs });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload video file.",
      },
      { status: 403 },
    );
  }
}
