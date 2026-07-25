import { NextResponse } from "next/server";
import { getDemoUserById } from "../../../../lib/auth";
import { createSessionToken, sessionCookieName } from "../../../../lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: unknown;
      loginCode?: unknown;
    };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const loginCode = typeof body.loginCode === "string" ? body.loginCode : "";
    const requiredCode = process.env.SAAS_LOGIN_CODE?.trim();

    if (requiredCode && loginCode !== requiredCode) {
      return NextResponse.json({ error: "登录验证码错误。" }, { status: 401 });
    }

    const user = getDemoUserById(userId);
    if (user.id !== userId) {
      return NextResponse.json({ error: "用户不存在。" }, { status: 404 });
    }

    const response = NextResponse.json({ user });
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
