import Link from "next/link";
import { requireAdminPage } from "@/app/lib/admin-access";
import { adminPayments, paymentStatuses, opsFilters } from "@/app/lib/admin-operations";
import { AdminSection, AdminMetrics, AdminFilters, AdminTable, AdminPagination, AdminBadge, adminDate, adminMoney } from "@/components/admin/AdminWorkspace";
import AdminAction from "@/components/admin/AdminAction";
import { commissionLabel } from "@/lib/payment-allocation";
import "./payments.css";

const labels: Record<string, string> = { SUCCEEDED: "Réussis", PARTIALLY_REFUNDED: "Partiellement remboursés", REFUNDED: "Remboursés", OPEN: "Ouverts", PENDING: "En attente", PROCESSING: "En traitement", FAILED: "Échoués", EXPIRED: "Expirés", CREATING: "Initialisation" };
export default async function PaymentsPage({ searchParams }: PageProps<"/admin/paiements">) {
  await requireAdminPage();
  const f = opsFilters(await searchParams, paymentStatuses);
  const data = await adminPayments(f);
  return <AdminSection title="Paiements et remboursements" description="">
    <AdminMetrics items={[
      { label: "Volume encaissé", value: adminMoney(data.gross) },
      { label: "Commissions HomeFix TN", value: adminMoney(data.commissions) },
      { label: "Solde des professionnels", value: adminMoney(data.professionals), detail: "Après remboursements et sanctions" },
      { label: "Remboursements confirmés", value: adminMoney(data.refunded), detail: `${data.pendingRefunds} remboursement(s) en attente` },
    ]}/>
    <AdminFilters {...f} options={paymentStatuses.map(value => ({ value, label: labels[value] ?? value }))}/>
    <AdminTable headings={["Transaction", "Client et intervention", "Montant", "Répartition", "Statut", "Actions"]} empty={!data.rows.length}>{data.rows.map(p => <tr key={p.id}>
      <td><strong>{adminDate(p.createdAt)}</strong></td>
      <td>{p.invoice.quote.request.client.name}<small>{p.invoice.quote.request.professional.businessName || p.invoice.quote.request.professional.name}</small><Link href={`/admin/demandes/${p.invoice.quote.request.id}`}>{p.invoice.quote.request.title}</Link></td>
      <td><strong>{adminMoney(p.amountMillimes)}</strong>{!!p.allocation?.refundedMillimes && <small>Remboursé : {adminMoney(p.allocation.refundedMillimes)}</small>}</td>
      <td>{p.allocation ? <details className="ap-allocation"><summary><span>HomeFix TN · {commissionLabel(p.allocation.commissionBps)}</span><strong>{adminMoney(p.allocation.commissionMillimes - p.allocation.refundedCommissionMillimes)}</strong></summary><dl>
        <div><dt>Montant initial</dt><dd>{adminMoney(p.allocation.grossMillimes)}</dd></div>
        <div><dt>Professionnel · {commissionLabel(10000 - p.allocation.commissionBps)}</dt><dd>{adminMoney(p.allocation.professionalMillimes)}</dd></div>
        <div><dt>Commission · {commissionLabel(p.allocation.commissionBps)}</dt><dd>{adminMoney(p.allocation.commissionMillimes)}</dd></div>
        {!!p.allocation.refundedMillimes && <><div><dt>Part professionnel annulée</dt><dd>−{adminMoney(p.allocation.refundedProfessionalMillimes)}</dd></div><div><dt>Commission annulée</dt><dd>−{adminMoney(p.allocation.refundedCommissionMillimes)}</dd></div></>}
        <div><dt>Net professionnel</dt><dd>{adminMoney(p.allocation.professionalMillimes - p.allocation.refundedProfessionalMillimes)}</dd></div>
      </dl>{p.allocation.historical && <small>Paiement antérieur · sans commission rétroactive</small>}</details> : <small>Disponible après confirmation</small>}</td>
      <td>{p.status === "PARTIALLY_REFUNDED" ? <span className="aw-badge tone-pending">Partiellement remboursé</span> : <AdminBadge value={p.status}/>} {p.refund && <small>Remboursement : <AdminBadge value={p.refund.status}/></small>}</td>
      <td>{p.status === "SUCCEEDED" && !p.refund && <AdminAction label="Rembourser" danger endpoint={`/api/admin/payments/${p.id}/refund`} payload={{ action: "REFUND" }} description={`Confirmer le remboursement intégral de ${adminMoney(p.amountMillimes)} dans la devise du paiement Stripe. Les deux soldes comptables seront ajustés.`} fields={[{ name: "reason", label: "Motif du remboursement", type: "textarea", min: 10 }]}/>} {p.refund && p.refund.status !== "SUCCEEDED" && <AdminAction label="Vérifier dans Stripe" endpoint={`/api/admin/payments/${p.id}/refund`} payload={{ action: "SYNC" }} description="Récupérer la confirmation Stripe de cette demande persistante."/>}</td>
    </tr>)}</AdminTable>
    <AdminPagination page={data.page} total={data.total} query={{ q: f.q, status: f.status }}/>
  </AdminSection>;
}
