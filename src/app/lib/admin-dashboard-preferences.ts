import "server-only";
import { prisma } from "./prisma";
import { readDashboardPreferences } from "@/lib/admin-dashboard-preferences";

// AdminSetting already stores JSON in PostgreSQL. Never accept this key from a client.
export function dashboardPreferenceKey(adminId: number) {
  return `DASHBOARD_PREFERENCES:${adminId}`;
}

export async function getAdminDashboardPreferences(adminId: number) {
  const setting = await prisma.adminSetting.findUnique({ where: { key: dashboardPreferenceKey(adminId) } });
  return readDashboardPreferences(setting?.value);
}
