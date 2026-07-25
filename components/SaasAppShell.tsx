"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Blocks,
  Bot,
  BrainCircuit,
  Building2,
  CheckSquare2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Database,
  Factory,
  FileVideo2,
  Gauge,
  Inbox,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Network,
  PackageCheck,
  RadioTower,
  Settings2,
  ShieldCheck,
  UsersRound,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";

type ShellMode = "admin" | "workspace";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

type SaasAppShellProps = {
  mode: ShellMode;
  title: string;
  subtitle: string;
  contextTitle?: string;
  contextMeta?: string;
  children: ReactNode;
};

const workspaceNavigation: NavItem[] = [
  { label: "今日工作台", href: "#today", icon: LayoutDashboard },
  { label: "内容工厂", href: "#foundation", icon: Factory },
  { label: "发布与渠道", href: "#channels", icon: RadioTower },
  { label: "客户与会话", href: "#operations", icon: Inbox },
  { label: "AI 任务中心", href: "#commander", icon: Workflow },
  { label: "审核中心", href: "#review", icon: ClipboardCheck, badge: "3" },
  { label: "数据复盘", href: "#analytics", icon: BarChart3 },
];

const adminNavigation: NavItem[] = [
  { label: "经营总览", href: "#admin-overview", icon: Gauge },
  { label: "客户管理", href: "#admin-customers", icon: Building2, badge: "5" },
  { label: "套餐与订阅", href: "#admin-plans", icon: PackageCheck },
  { label: "行业模板", href: "#admin-industries", icon: Layers3 },
  { label: "AI 与自动化", href: "#admin-ai", icon: BrainCircuit },
  { label: "功能与连接器", href: "#admin-production", icon: Blocks },
  { label: "用量与账单", href: "#admin-usage", icon: Activity },
  { label: "审计与安全", href: "#admin-readiness", icon: ShieldCheck },
];

export function SaasAppShell({
  mode,
  title,
  subtitle,
  contextTitle,
  contextMeta,
  children,
}: SaasAppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigation = mode === "admin" ? adminNavigation : workspaceNavigation;
  const [activeHref, setActiveHref] = useState(navigation[0].href);
  const utilityLinks = mode === "admin"
    ? [
        { label: "平台配置", href: "#admin-ai", icon: Settings2 },
        { label: "上线检查", href: "#admin-production", icon: CircleHelp },
      ]
    : [
        { label: "资料与权限", href: "#foundation", icon: Settings2 },
        { label: "渠道实施帮助", href: "#channels", icon: CircleHelp },
      ];

  useEffect(() => {
    function syncHash() {
      const nextHash = window.location.hash;
      if (navigation.some((item) => item.href === nextHash)) {
        setActiveHref(nextHash);
      }
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [navigation]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <div className={`saas-app-frame ${mobileOpen ? "nav-open" : ""}`}>
      <button
        className="mobile-nav-backdrop"
        type="button"
        aria-label="关闭导航"
        onClick={() => setMobileOpen(false)}
      />

      <aside className="saas-sidebar" aria-label={mode === "admin" ? "平台管理导航" : "客户工作区导航"}>
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            <Bot size={23} strokeWidth={2.25} />
          </span>
          <span>
            <strong>营收指挥舱</strong>
            <small>{mode === "admin" ? "SaaS Platform" : "AI Revenue OS"}</small>
          </span>
          <button type="button" className="mobile-nav-close" onClick={() => setMobileOpen(false)} aria-label="关闭导航">
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-context">
          <span>{mode === "admin" ? "平台管理端" : "客户运营端"}</span>
          <strong>{contextTitle ?? (mode === "admin" ? "商业化控制台" : "客户工作区")}</strong>
          <small>{contextMeta ?? (mode === "admin" ? "5 个客户工作区" : "套餐与到期状态")}</small>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-nav-label">工作区</span>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={activeHref === item.href ? "active" : ""}
                onClick={() => {
                  setActiveHref(item.href);
                  setMobileOpen(false);
                }}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
                {item.badge && <em>{item.badge}</em>}
              </a>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          {utilityLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            );
          })}
          <div className="sidebar-health">
            <span />
            <div>
              <strong>{mode === "admin" ? "配置中心正常" : "自动驾驶已就绪"}</strong>
              <small>{mode === "admin" ? "模型与策略可管理" : "异常将自动暂停并上报"}</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="saas-main-column">
        <header className="saas-topbar">
          <div className="topbar-title">
            <button type="button" className="mobile-nav-trigger" onClick={() => setMobileOpen(true)} aria-label="打开导航">
              <Menu size={22} />
            </button>
            <div>
              <span>{title}</span>
              <small>{subtitle}</small>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="topbar-status">
              <span />
              {mode === "admin" ? "平台运行中" : "账号有效"}
            </div>
            <Link className="topbar-switch" href={mode === "admin" ? "/workspace" : "/admin"}>
              {mode === "admin" ? <UsersRound size={17} /> : <ShieldCheck size={17} />}
              {mode === "admin" ? "进入客户工作台" : "平台总后台"}
              <ChevronRight size={16} />
            </Link>
            <button className="topbar-switch topbar-logout" type="button" onClick={logout}>
              <LogOut size={17} />
              退出
            </button>
          </div>
        </header>

        <div className="saas-content">{children}</div>
      </div>
    </div>
  );
}
