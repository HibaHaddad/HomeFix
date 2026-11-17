import { requireAdminPage } from "@/app/lib/admin-access";
import { adminPayments, paymentStatuses, opsFilters } from "@/app/lib/admin-operations";
import { paymentPeriod } from "@/lib/admin-payment-filters";
import AdminPayments from "@/components/admin/AdminPayments";
import "./payments.css";

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/paiements">) {
  await requireAdminPage();
  const params = await searchParams;
  const one = (key: string) => Array.isArray(params[key]) ? params[key][0] : params[key];
  const period = paymentPeriod(one("from"), one("to"));
  const filters = { ...opsFilters(params, paymentStatuses), from: period.from, to: period.to };
  return <AdminPayments data={await adminPayments(filters)} filters={filters} statuses={paymentStatuses}/>;
}
