import { AdminDashboard } from "../../components/AdminDashboard";
import { SaasAppShell } from "../../components/SaasAppShell";

export default function AdminPage() {
  return (
    <SaasAppShell
      mode="admin"
      title="平台经营总览"
      subtitle="管理客户、模型、自动化策略、连接器与商业化运行状态"
      contextTitle="商业化控制台"
      contextMeta="5 个客户工作区"
    >
      <AdminDashboard />
    </SaasAppShell>
  );
}
