import { NextResponse } from "next/server";
import { getDemoUserById } from "../../../../lib/auth";
import { createSessionToken, sessionCookieName } from "../../../../lib/session";

export const runtime = "nodejs";

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/workspace";
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isJsonRequest = contentType.includes("application/json");
    let userId = "";
    let loginCode = "";

    if (isJsonRequest) {
      const body = (await request.json()) as {
        userId?: unknown;
        loginCode?: unknown;
      };
      userId = typeof body.userId === "string" ? body.userId : "";
      loginCode = typeof body.loginCode === "string" ? body.loginCode : "";
    } else {
      const formData = await request.formData();
      const formUserId = formData.get("userId");
      const formLoginCode = formData.get("loginCode");
      userId = typeof formUserId === "string" ? formUserId : "";
      loginCode = typeof formLoginCode === "string" ? formLoginCode : "";
    }
    const requiredCode = process.env.SAAS_LOGIN_CODE?.trim();

    if (requiredCode && loginCode !== requiredCode) {
      return NextResponse.json({ error: "登录验证码错误。" }, { status: 401 });
    }

    const user = getDemoUserById(userId);
    if (user.id !== userId) {
      return NextResponse.json({ error: "用户不存在。" }, { status: 404 });
    }

    const requestUrl = new URL(request.url);
    const browserOrigin = request.headers.get("origin") ?? requestUrl.origin;
    const response = isJsonRequest
      ? NextResponse.json({ user })
      : NextResponse.redirect(
          new URL(normalizeNextPath(requestUrl.searchParams.get("next")), browserOrigin),
          303,
        );
    response.cookies.set(sessionCookieName, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to login.",
      },
      { status: 500 },
    );
  }
}
