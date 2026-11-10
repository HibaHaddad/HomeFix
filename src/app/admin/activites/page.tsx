import { requireAdminPage } from "@/app/lib/admin-access";
import { adminAudit, opsFilters } from "@/app/lib/admin-operations";
import { prisma } from "@/app/lib/prisma";
import { AdminSection, AdminFilters, AdminTable, AdminPagination, adminDate } from "@/components/admin/AdminWorkspace";
export default async function AuditPage({ searchParams }: PageProps<"/admin/activites">) {
  await requireAdminPage();
  const actions = await prisma.adminAuditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
  const f = opsFilters(await searchParams, actions.map(a => a.action));
  const data = await adminAudit(f);
  return <AdminSection title="Journal d’audit" description="Une trace datée des décisions, changements et consultations sensibles. Le journal ne propose aucune modification ni suppression."><AdminFilters {...f} options={actions.map(a => ({ value: a.action, label: a.action }))}/><AdminTable headings={["Date · Tunis", "Administrateur", "Action", "Cible", "Motif et détails"]} empty={!data.rows.length}>{data.rows.map(a => <tr key={a.id}><td>{adminDate(a.createdAt)}<small>Événement #{a.id}</small></td><td><strong>{a.actorName}</strong><small>Compte #{a.actorId}</small></td><td>{a.action}</td><td>{a.target}</td><td><p className="aw-prose">{a.reason || "—"}</p><details><summary>Détails</summary><pre className="aw-prose">{JSON.stringify(a.details, null, 2)}</pre></details></td></tr>)}</AdminTable><AdminPagination page={data.page} total={data.total} query={{ q: f.q, status: f.status }}/></AdminSection>;
}
