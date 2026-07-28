import { CommanderDashboard } from "../../../components/CommanderDashboard";
import { SaasAppShell } from "../../../components/SaasAppShell";
import { getTenantById } from "../../../lib/saas";

type WorkspaceViewPageProps = {
  params?: Promise<{
    view?: string;
  }>;
  searchParams?: Promise<{
    tenant?: string | string[];
  }>;
};

const workspaceViewLabels: Record<string, string> = {
  today: "今日待办",
  plan: "获客计划向导",
  acquisition: "AI 获客舱",
  radar: "公域获客雷达",
  accounts: "账号矩阵",
  foundation: "知识库与素材",
  video: "视频创作中心",
  channels: "发布与渠道",
  inbox: "私信聚合",
  crm: "线索 CRM",
  replies: "自动回复策略",
  sop: "销售 SOP",
  commander: "AI 员工与任务",
  review: "审核与合规",
  analytics: "数据复盘",
  settings: "资料与设置",
  operations: "行业运营中心",
};

export default async function WorkspaceViewPage({
  params,
  searchParams,
}: WorkspaceViewPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const tenant = Array.isArray(resolvedSearchParams?.tenant)
    ? resolvedSearchParams?.tenant[0]
    : resolvedSearchParams?.tenant;
  const currentTenant = getTenantById(tenant);
  const view = resolvedParams?.view ?? "today";

  return (
    <SaasAppShell
      mode="workspace"
      title={workspaceViewLabels[view] ?? "客户工作台"}
      subtitle={`${currentTenant.name} · ${workspaceViewLabels[view] ?? "运营功能"}`}
      contextTitle={currentTenant.name}
      contextMeta={`${currentTenant.plan} · ${currentTenant.renewalDate} 到期`}
      tenantId={currentTenant.id}
    >
      <CommanderDashboard initialTenantId={tenant} initialView={view} />
    </SaasAppShell>
  );
}
