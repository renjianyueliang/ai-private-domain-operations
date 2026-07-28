import { CommanderDashboard } from "../../components/CommanderDashboard";
import { SaasAppShell } from "../../components/SaasAppShell";
import { getTenantById } from "../../lib/saas";

type WorkspacePageProps = {
  searchParams?: Promise<{
    tenant?: string | string[];
  }>;
};

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const params = await searchParams;
  const tenant = Array.isArray(params?.tenant) ? params?.tenant[0] : params?.tenant;
  const currentTenant = getTenantById(tenant);

  return (
    <SaasAppShell
      mode="workspace"
      title="营收自动驾驶工作台"
      subtitle={`${currentTenant.name} · 内容、获客、私域、成交与收益归因`}
      contextTitle={currentTenant.name}
      contextMeta={`${currentTenant.plan} · ${currentTenant.renewalDate} 到期`}
      tenantId={currentTenant.id}
    >
      <CommanderDashboard initialTenantId={tenant} initialView="today" />
    </SaasAppShell>
  );
}
