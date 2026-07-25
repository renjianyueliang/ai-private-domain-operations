export type DemoRole = "platform_admin" | "tenant_admin" | "operator" | "viewer";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: DemoRole;
  tenantIds: string[];
};

export const demoUsers: DemoUser[] = [
  {
    id: "user-platform-admin",
    name: "平台管理员",
    email: "admin@ai-saas.local",
    role: "platform_admin",
    tenantIds: ["*"],
  },
  {
    id: "user-tenant-admin",
    name: "客户管理员",
    email: "owner@tenant.local",
    role: "tenant_admin",
    tenantIds: [
      "tenant-gold-academy",
      "tenant-futures-club",
      "tenant-finance-advisory",
      "tenant-aesthetic-clinic",
      "tenant-tcm-clinic",
    ],
  },
  {
    id: "user-operator",
    name: "运营员工",
    email: "operator@tenant.local",
    role: "operator",
    tenantIds: ["tenant-aesthetic-clinic", "tenant-tcm-clinic"],
  },
  {
    id: "user-viewer",
    name: "只读观察员",
    email: "viewer@tenant.local",
    role: "viewer",
    tenantIds: ["tenant-aesthetic-clinic"],
  },
];

export const roleLabels: Record<DemoRole, string> = {
  platform_admin: "平台管理员",
  tenant_admin: "客户管理员",
  operator: "运营员工",
  viewer: "只读观察员",
};

export function getDemoUserById(id?: string | null) {
  return demoUsers.find((user) => user.id === id) ?? demoUsers[1];
}

export function canAccessTenant(user: DemoUser, tenantId: string) {
  return user.tenantIds.includes("*") || user.tenantIds.includes(tenantId);
}

export function canWriteTenantData(user: DemoUser, tenantId: string) {
  return (
    canAccessTenant(user, tenantId) &&
    ["platform_admin", "tenant_admin", "operator"].includes(user.role)
  );
}

export function canManagePlatform(user: DemoUser) {
  return user.role === "platform_admin";
}
