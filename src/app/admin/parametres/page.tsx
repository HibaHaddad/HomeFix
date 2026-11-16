import { requireAdminPage } from "@/app/lib/admin-access";
import { AdminSection } from "@/components/admin/AdminWorkspace";
import AdminDashboardPreferences from "@/components/admin/AdminDashboardPreferences";
import { getAdminDashboardPreferences } from "@/app/lib/admin-dashboard-preferences";
import { getCommissionBps } from "@/app/lib/payment-accounting";
import AdminCommissionSettings from "@/components/admin/AdminCommissionSettings";
export default async function SettingsPage() {
  const admin = await requireAdminPage();
  const preferences = await getAdminDashboardPreferences(admin.id);
  const commissionBps = await getCommissionBps();
  return <AdminSection title="Paramètres Admin" description="">
    <AdminDashboardPreferences initialPreferences={preferences}/>
    <AdminCommissionSettings initialBps={commissionBps}/>
  </AdminSection>;
}
