import Link from "next/link";
import { requireAdminPage } from "@/app/lib/admin-access";
import { adminBookings, bookingStatuses, opsFilters } from "@/app/lib/admin-operations";
import { AdminSection, AdminFilters, AdminTable, AdminPagination, AdminBadge, adminDate } from "@/components/admin/AdminWorkspace";
export default async function BookingsPage({ searchParams }: PageProps<"/admin/reservations">) {
  await requireAdminPage();
  const f = opsFilters(await searchParams, bookingStatuses);
  const data = await adminBookings(f);
  return <AdminSection title="Réservations" description="Suivez les créneaux et les confirmations, sans modifier les engagements des clients et professionnels."><AdminFilters {...f} options={bookingStatuses.map(value => ({ value, label: ({ PROPOSED: "Proposées", COUNTER_PROPOSED: "Contre-propositions", CONFIRMED: "Confirmées", CANCELLED: "Annulées", REJECTED: "Refusées", COMPLETED: "Terminées" })[value] ?? value }))}/><AdminTable headings={["Réservation", "Participants", "Créneau · Tunis", "Statut", "Intervention"]} empty={!data.rows.length}>{data.rows.map(b => <tr key={b.id}><td><strong>#{b.id} · {b.request.title}</strong>{b.reason && <p className="aw-prose">{b.reason}</p>}</td><td>{b.request.client.name}<small>{b.request.professional.businessName || b.request.professional.name}</small></td><td>{adminDate(b.startsAt)}<small>Fin : {adminDate(b.endsAt)}</small></td><td><AdminBadge value={b.status}/></td><td><Link href={`/admin/demandes/${b.request.id}`}>Voir le suivi #{b.request.id}</Link><small><AdminBadge value={b.request.status}/></small></td></tr>)}</AdminTable><AdminPagination page={data.page} total={data.total} query={{ q: f.q, status: f.status }}/></AdminSection>;
}
