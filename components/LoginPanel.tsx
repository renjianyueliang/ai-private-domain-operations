"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { demoUsers, roleLabels } from "../lib/auth";

type LoginPanelProps = {
  nextPath: string;
};

export function LoginPanel({ nextPath }: LoginPanelProps) {
  const [selectedUserId, setSelectedUserId] = useState("user-platform-admin");
  const [loginCode, setLoginCode] = useState("");
  const [message, setMessage] = useState("请选择一个演示身份登录。生产环境可替换为手机号、邮箱或企业 SSO。");
  const [isLoading, setIsLoading] = useState(false);

  const selectedUser = useMemo(
    () => demoUsers.find((user) => user.id === selectedUserId) ?? demoUsers[0],
    [selectedUserId],
  );

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setMessage("正在建立安全会话...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, loginCode }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "登录失败。");
      }

      window.location.assign(nextPath || "/workspace");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-label="系统登录">
        <div className="login-copy">
          <div className="section-kicker">AI 私域 SaaS</div>
          <h1>登录营收指挥舱</h1>
          <p>平台后台与客户工作台已经开启路由保护。登录后会根据角色进入可访问的客户和管理范围。</p>
          <div className="login-security-note">
            <ShieldCheck size={18} />
            <span>会话使用 httpOnly Cookie；生产环境应接入真实账号、强密码策略、SSO、审计日志和 MFA。</span>
          </div>
        </div>

        <form
          className="login-form"
          action={`/api/auth/login?next=${encodeURIComponent(nextPath || "/workspace")}`}
          method="post"
          onSubmit={submitLogin}
        >
          <div className="login-form-heading">
            <LockKeyhole size={22} />
            <div>
              <strong>选择登录身份</strong>
              <span>当前为可替换的生产登录骨架</span>
            </div>
          </div>

          <label>
            账号角色
            <select
              name="userId"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              {demoUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {roleLabels[user.role]}
                </option>
              ))}
            </select>
          </label>

          <label>
            登录验证码
            <input
              name="loginCode"
              value={loginCode}
              onChange={(event) => setLoginCode(event.target.value)}
              placeholder="未配置 SAAS_LOGIN_CODE 时可留空"
              autoComplete="one-time-code"
            />
          </label>

          <div className="login-account-preview">
            <span>当前账号</span>
            <strong>{selectedUser.email}</strong>
            <small>{selectedUser.tenantIds.includes("*") ? "可管理所有客户工作区" : `可访问 ${selectedUser.tenantIds.length} 个客户工作区`}</small>
          </div>

          <div className="login-message" role="status">
            {message}
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "登录中" : "登录并进入系统"}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </main>
  );
}
