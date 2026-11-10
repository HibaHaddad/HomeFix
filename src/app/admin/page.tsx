import AdminDashboard from "@/components/admin/AdminDashboard";
import { requireAdminPage } from "@/app/lib/admin-access";
import { getAdminDashboardData, dashboardPeriods, type DashboardPeriod } from "@/app/lib/admin-dashboard";

export default async function AdminIndex({ searchParams }: PageProps<"/admin">) {
  await requireAdminPage();
  const params = await searchParams;
  const requested = params.period;
  const period: DashboardPeriod = dashboardPeriods.includes(requested as DashboardPeriod)
    ? requested as DashboardPeriod
    : "30d";
  const data = await getAdminDashboardData(period);

  return <AdminDashboard data={data} />;
}
