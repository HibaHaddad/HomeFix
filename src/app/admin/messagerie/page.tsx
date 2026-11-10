import Link from "next/link";
import { requireAdminPage } from "@/app/lib/admin-access";
import { adminConversations, opsFilters } from "@/app/lib/admin-operations";
import { AdminSection, AdminFilters, AdminTable, AdminPagination, adminDate } from "@/components/admin/AdminWorkspace";
export default async function ConversationsPage({ searchParams }: PageProps<"/admin/messagerie">) {
  await requireAdminPage();
  const f = opsFilters(await searchParams);
  const data = await adminConversations(f);
  return <AdminSection title="Messagerie" description="Retrouvez un échange Client–Professionnel pour instruire un dossier. Le contenu reste protégé jusqu’à une consultation motivée."><AdminFilters {...f} options={[]}/><AdminTable headings={["Conversation", "Client", "Professionnel", "Dernière activité", "Consultation"]} empty={!data.rows.length}>{data.rows.map(c => <tr key={c.id}><td><strong>#{c.id} · {c.title}</strong></td><td>{c.client.name}</td><td>{c.professional.businessName || c.professional.name}</td><td>{adminDate(c.updatedAt)}</td><td><Link prefetch={false} href={`/admin/messagerie/${c.id}`}>Examiner le dossier</Link></td></tr>)}</AdminTable><AdminPagination page={data.page} total={data.total} query={{ q: f.q }}/></AdminSection>;
}
