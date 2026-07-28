import { AdminDashboard } from "../../../components/AdminDashboard";
import { SaasAppShell } from "../../../components/SaasAppShell";

type AdminViewPageProps = {
  params?: Promise<{
    view?: string;
  }>;
};

const adminViewLabels: Record<string, string> = {
  overview: "平台经营总览",
  customers: "客户与租户",
  plans: "套餐与开通",
  usage: "用量与账单",
  templates: "行业模板库",
  features: "功能授权矩阵",
  ai: "模型与自动化",
  connectors: "连接器与生产依赖",
  audit: "审计与风控",
  readiness: "上线清单",
};

export default async function AdminViewPage({ params }: AdminViewPageProps) {
  const resolvedParams = await params;
  const view = resolvedParams?.view ?? "overview";
  const title = adminViewLabels[view] ?? "平台后台";

  return (
    <SaasAppShell
      mode="admin"
      title={title}
      subtitle="管理客户、套餐、权限、连接器、模型、审计与上线状态"
      contextTitle="商业化控制台"
      contextMeta="5 个客户工作区"
    >
      <AdminDashboard initialView={view} />
    </SaasAppShell>
  );
}
