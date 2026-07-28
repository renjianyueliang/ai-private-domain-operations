"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
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
  Radar,
  RadioTower,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
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

type NavSection = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

type SaasAppShellProps = {
  mode: ShellMode;
  title: string;
  subtitle: string;
  contextTitle?: string;
  contextMeta?: string;
  tenantId?: string;
  children: ReactNode;
};

const workspaceNavigation: NavSection[] = [
  {
    label: "今日工作",
    icon: LayoutDashboard,
    items: [
      { label: "今日待办", href: "/workspace/today", icon: CheckSquare2 },
      { label: "AI 员工与任务", href: "/workspace/commander", icon: Workflow },
      { label: "审核与合规", href: "/workspace/review", icon: ClipboardCheck, badge: "3" },
    ],
  },
  {
    label: "获客增长",
    icon: Target,
    items: [
      { label: "获客计划向导", href: "/workspace/plan", icon: Sparkles, badge: "新" },
      { label: "AI 获客舱", href: "/workspace/acquisition", icon: Target },
      { label: "公域获客雷达", href: "/workspace/radar", icon: Radar },
      { label: "账号矩阵", href: "/workspace/accounts", icon: Network },
    ],
  },
  {
    label: "内容视频",
    icon: Factory,
    items: [
      { label: "知识库与素材", href: "/workspace/foundation", icon: Database },
      { label: "视频创作中心", href: "/workspace/video", icon: FileVideo2 },
      { label: "发布与渠道", href: "/workspace/channels", icon: RadioTower },
    ],
  },
  {
    label: "私域成交",
    icon: Inbox,
    items: [
      { label: "私信聚合", href: "/workspace/inbox", icon: Inbox },
      { label: "自动回复策略", href: "/workspace/replies", icon: MessageSquareText },
      { label: "线索 CRM", href: "/workspace/crm", icon: UsersRound },
      { label: "销售 SOP", href: "/workspace/sop", icon: ClipboardCheck },
    ],
  },
  {
    label: "复盘设置",
    icon: BarChart3,
    items: [
      { label: "数据复盘", href: "/workspace/analytics", icon: BarChart3 },
      { label: "资料与设置", href: "/workspace/settings", icon: Settings2 },
    ],
  },
];

const adminNavigation: NavSection[] = [
  {
    label: "运营总览",
    icon: Gauge,
    items: [
      { label: "经营总览", href: "/admin/overview", icon: Gauge },
      { label: "客户管理", href: "/admin/customers", icon: Building2, badge: "5" },
    ],
  },
  {
    label: "商业授权",
    icon: PackageCheck,
    items: [
      { label: "套餐与订阅", href: "/admin/plans", icon: PackageCheck },
      { label: "用量与账单", href: "/admin/usage", icon: Activity },
    ],
  },
  {
    label: "能力配置",
    icon: Layers3,
    items: [
      { label: "行业模板", href: "/admin/templates", icon: Layers3 },
      { label: "功能权限", href: "/admin/features", icon: Blocks },
      { label: "AI 与自动化", href: "/admin/ai", icon: BrainCircuit },
      { label: "连接器中心", href: "/admin/connectors", icon: RadioTower },
    ],
  },
  {
    label: "安全上线",
    icon: ShieldCheck,
    items: [
      { label: "风控审计", href: "/admin/audit", icon: ShieldCheck },
      { label: "上线检查", href: "/admin/readiness", icon: CircleHelp },
    ],
  },
];

function getFirstNavigationHref(navigation: NavSection[], mode: ShellMode) {
  return navigation[0]?.items[0]?.href ?? (mode === "admin" ? "/admin/overview" : "/workspace/today");
}

function normalizePathname(pathname: string, mode: ShellMode) {
  if (mode === "admin" && pathname === "/admin") return "/admin/overview";
  if (mode === "workspace" && pathname === "/workspace") return "/workspace/today";
  return pathname;
}

function withTenant(href: string, tenantId?: string) {
  if (!tenantId || !href.startsWith("/workspace")) return href;
  return `${href}?tenant=${encodeURIComponent(tenantId)}`;
}

export function SaasAppShell({
  mode,
  title,
  subtitle,
  contextTitle,
  contextMeta,
  tenantId,
  children,
}: SaasAppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const navigation = mode === "admin" ? adminNavigation : workspaceNavigation;
  const activeHref = useMemo(
    () => normalizePathname(pathname, mode),
    [mode, pathname],
  );
  const utilityLinks = mode === "admin"
    ? [
        { label: "平台配置", href: "/admin/ai", icon: Settings2 },
        { label: "上线检查", href: "/admin/readiness", icon: CircleHelp },
      ]
    : [
        { label: "资料与设置", href: "/workspace/settings", icon: Settings2 },
        { label: "渠道实施帮助", href: "/workspace/channels", icon: CircleHelp },
      ];

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
          {navigation.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div className="sidebar-section" key={section.label}>
                <div className="sidebar-section-title">
                  <SectionIcon size={15} strokeWidth={2.1} aria-hidden="true" />
                  <span>{section.label}</span>
                </div>
                <div className="sidebar-subnav">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.href}
                        href={withTenant(item.href, tenantId)}
                        className={activeHref === item.href ? "active" : ""}
                        onClick={() => {
                          setMobileOpen(false);
                        }}
                      >
                        <Icon size={17} strokeWidth={2} aria-hidden="true" />
                        <span>{item.label}</span>
                        {item.badge && <em>{item.badge}</em>}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          {utilityLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={withTenant(item.href, tenantId)} onClick={() => setMobileOpen(false)}>
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
            <Link className="topbar-switch" href={mode === "admin" ? withTenant("/workspace/today", tenantId) : "/admin/overview"}>
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
