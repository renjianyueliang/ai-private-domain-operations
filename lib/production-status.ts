import { listBillingRecords } from "./billing";
import { summarizeConnectorStatus } from "./connectors";
import { getStorageMode, isPostgresConfigured } from "./database";
import { getObjectStorageStatus } from "./object-storage";
import { listTenantDrafts } from "./platform-store";
import { getQueueStatus } from "./queue-driver";
import type { DemoUser } from "./auth";

type ProductionStatusOptions = {
  currentUser?: DemoUser | null;
};

export async function getProductionStatus(options: ProductionStatusOptions = {}) {
  const [tenantDrafts, billingRecords] = await Promise.all([
    listTenantDrafts(),
    listBillingRecords(),
  ]);
  const connectors = summarizeConnectorStatus();
  const storage = getObjectStorageStatus();
  const queue = getQueueStatus();

  return {
    generatedAt: new Date().toISOString(),
    database: {
      mode: getStorageMode(),
      configured: isPostgresConfigured(),
      note: isPostgresConfigured()
        ? "DATABASE_URL 已配置，运行时数据写入 PostgreSQL。"
        : "未配置 DATABASE_URL，运行时数据写入 .local-data。",
    },
    auth: {
      configured: Boolean(process.env.SAAS_SESSION_SECRET?.trim()),
      loginCodeRequired: Boolean(process.env.SAAS_LOGIN_CODE?.trim()),
      sessionActive: Boolean(options.currentUser),
      currentUser: options.currentUser
        ? {
            id: options.currentUser.id,
            name: options.currentUser.name,
            role: options.currentUser.role,
          }
        : null,
      note: process.env.SAAS_SESSION_SECRET?.trim()
        ? "会话密钥已配置。"
        : "当前使用开发默认会话密钥，生产必须设置 SAAS_SESSION_SECRET。",
    },
    storage,
    queue,
    connectors,
    billing: {
      storageMode: billingRecords.storageMode,
      records: billingRecords.billingRecords.length,
      note: "已支持合同、发票、收款记录；真实支付网关需配置第三方商户信息。",
    },
    onboarding: {
      storageMode: tenantDrafts.storageMode,
      tenantDrafts: tenantDrafts.tenantDrafts.length,
    },
  };
}
