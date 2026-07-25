import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { demoUsers, getDemoUserById, type DemoUser } from "./auth";

export const sessionCookieName = "ai_saas_session";

type SessionPayload = {
  userId: string;
  exp: number;
};

function getSessionSecret() {
  return process.env.SAAS_SESSION_SECRET?.trim() || "dev-only-ai-saas-session-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function signaturesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionToken(userId: string, maxAgeSeconds = 60 * 60 * 12) {
  if (!demoUsers.some((user) => user.id === userId)) {
    throw new Error("用户不存在。");
  }

  const payload = base64UrlEncode(
    JSON.stringify({
      userId,
      exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    } satisfies SessionPayload),
  );
  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !signaturesMatch(signPayload(payload), signature)) {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as SessionPayload;
    if (!decoded.userId || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return getDemoUserById(decoded.userId);
  } catch {
    return null;
  }
}

function getCookieFromHeader(headerValue?: string | null) {
  if (!headerValue) return null;

  const cookie = headerValue
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));

  return cookie?.slice(sessionCookieName.length + 1) ?? null;
}

export function getUserFromRequest(request: Request): DemoUser {
  const token = getCookieFromHeader(request.headers.get("cookie"));
  const sessionUser = verifySessionToken(token);
  if (sessionUser) return sessionUser;

  return getDemoUserById(request.headers.get("x-demo-user"));
}

export async function getUserFromServerCookies(): Promise<DemoUser> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(sessionCookieName)?.value) ?? demoUsers[1];
}
