"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Banknote, CalendarDays, ChevronLeft, ChevronRight, Clock3, CreditCard, ExternalLink, Eye, FileText, MoreHorizontal, ReceiptText, RotateCcw, Search, Wallet, X } from "lucide-react";
import type { adminPayments, opsFilters } from "@/app/lib/admin-operations";
import { commissionLabel } from "@/lib/payment-allocation";
import { AdminSection, adminDate, adminMoney } from "./AdminWorkspace";
import AdminAction from "./AdminAction";
import AdminAutoFiltersForm from "./AdminAutoFiltersForm";
import AdminReviewAvatar from "./AdminReviewAvatar";

type Data = Awaited<ReturnType<typeof adminPayments>>;
type Payment = Data["rows"][number];
type Filters = ReturnType<typeof opsFilters> & { from: string; to: string };
const labels: Record<string, string> = { SUCCEEDED: "Réussi", PARTIALLY_REFUNDED: "Remboursé en partie", REFUNDED: "Remboursé", OPEN: "Ouvert", PENDING: "En attente", PROCESSING: "En traitement", FAILED: "Échoué", EXPIRED: "Expiré", CREATING: "Initialisation" };
const shortDate = (value: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Tunis" }).format(new Date(value));
const time = (value: Date) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" }).format(new Date(value));
function receipt(payment: Payment) {
  return payment.paymentIntentId && ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status)
    ? `/api/admin/payments/${payment.id}/recu` : null;
}
function PaymentStatus({ status }: { status: string }) {
  const tone = status === "SUCCEEDED" ? "green" : ["REFUNDED", "PARTIALLY_REFUNDED", "FAILED"].includes(status) ? "red" : status === "EXPIRED" ? "neutral" : "orange";
  return <span className={`ap-status ap-${tone}`}><i/>{labels[status] ?? status}</span>;
}
function Person({ person, professional = false }: { person: Payment["invoice"]["quote"]["request"]["professional"] | Payment["invoice"]["quote"]["request"]["client"]; professional?: boolean }) {
  const name = "businessName" in person ? person.businessName || person.name : person.name;
  return <div className="ap-person"><AdminReviewAvatar userId={person.id} name={name} hasPhoto={!!person.profilePhotoMime} professional={professional}/><span title={name}>{name}</span></div>;
}
function PaymentActions({ payment, onDetails }: { payment: Payment; onDetails: () => void }) {
  const menu = useRef<HTMLDivElement>(null);
  const refundTrigger = useRef<HTMLDivElement>(null);
  const syncTrigger = useRef<HTMLDivElement>(null);
  const id = useId();
  const receiptUrl = receipt(payment);
  return <>
    <button type="button" className="ap-more" aria-label={`Actions de la transaction ${payment.id}`} popoverTarget={id} aria-haspopup="true" onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (menu.current) {
        menu.current.style.left = `${Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232))}px`;
        menu.current.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 210))}px`;
      }
    }}><MoreHorizontal size={19}/></button>
    <div className="ap-action-menu" id={id} popover="auto" ref={menu} onClick={() => menu.current?.hidePopover()}>
      <span className="ap-menu-label">TRANSACTION</span>
      <button type="button" onClick={onDetails}><Eye size={15}/>Voir les détails</button>
      {receiptUrl ? <a href={receiptUrl} target="_blank" rel="noreferrer"><ReceiptText size={15}/>Consulter le reçu<ExternalLink size={12}/></a> : <button type="button" disabled title="Le reçu sera disponible après confirmation du paiement"><ReceiptText size={15}/>Reçu indisponible</button>}
      {payment.status === "SUCCEEDED" && !payment.refund && <button type="button" className="ap-refund-action" onClick={() => refundTrigger.current?.querySelector("button")?.click()}><RotateCcw size={15}/>Rembourser</button>}
      {payment.refund && payment.refund.status !== "SUCCEEDED" && <button type="button" onClick={() => syncTrigger.current?.querySelector("button")?.click()}><RotateCcw size={15}/>Vérifier dans Stripe</button>}
    </div>
    {/* Keep confirmation dialogs outside the popover so closing the menu cannot hide them. */}
    {payment.status === "SUCCEEDED" && !payment.refund && <div className="ap-action-host" ref={refundTrigger}><AdminAction label="Rembourser" danger endpoint={`/api/admin/payments/${payment.id}/refund`} payload={{ action: "REFUND" }} description={`Confirmer le remboursement intégral de ${adminMoney(payment.amountMillimes)} dans la devise du paiement Stripe. Les deux soldes comptables seront ajustés.`} fields={[{ name: "reason", label: "Motif du remboursement", type: "textarea", min: 10 }]}/></div>}
    {payment.refund && payment.refund.status !== "SUCCEEDED" && <div className="ap-action-host" ref={syncTrigger}><AdminAction label="Vérifier dans Stripe" endpoint={`/api/admin/payments/${payment.id}/refund`} payload={{ action: "SYNC" }} description="Récupérer la confirmation Stripe de cette demande persistante."/></div>}
  </>;
}

export default function AdminPayments({ data, filters, statuses }: { data: Data; filters: Filters; statuses: string[] }) {
  const [selected, setSelected] = useState<Payment | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    else if (!selected) dialog.current?.close();
  }, [selected]);
  const metrics = [
    { label: "Volume encaissé", value: adminMoney(data.gross), detail: "Total des encaissements", icon: Banknote, tone: "green" },
    { label: "Commissions HomeFix", value: adminMoney(data.commissions), detail: "Commissions nettes de remboursements", icon: ArrowUpRight, tone: "green" },
    { label: "Solde professionnels", value: adminMoney(data.professionals), detail: "Après remboursements et sanctions", icon: Wallet, tone: "green" },
    { label: "Remboursements", value: adminMoney(data.refunded), detail: `${data.pendingRefunds} remboursement${data.pendingRefunds > 1 ? "s" : ""} en attente`, icon: ArrowDownLeft, tone: "red" },
    { label: "Paiements en attente", value: String(data.pendingPayments), detail: "Initialisation, ouverts ou en traitement", icon: Clock3, tone: "orange" },
  ];
  const filtered = Boolean(filters.q || filters.status !== "ALL" || filters.from || filters.to);
  const pages = Math.max(1, Math.ceil(data.total / 20));
  const href = (page: number) => `?${new URLSearchParams({ q: filters.q, status: filters.status, from: filters.from, to: filters.to, page: String(page) })}`;
  const a = selected?.allocation;
  const request = selected?.invoice.quote.request;
  return <div className="ap-page"><AdminSection title="Paiements et remboursements" description="Suivez les encaissements, la répartition des revenus et les remboursements." eyebrow="FINANCES · HOMEFIX TN">
    <div className="ap-overview-label"><span>Vue financière globale</span><small>Toutes les périodes · TND</small></div>
    <section className="ap-kpis" aria-label="Indicateurs financiers">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <article className={`admin-kpi-card ap-kpi ap-${tone}`} key={label}><span className="admin-kpi-icon"><Icon size={20} strokeWidth={1.8}/></span><span className="admin-kpi-label">{label}</span><strong className="admin-kpi-value">{value}</strong><small className="admin-kpi-detail">{detail}</small></article>)}</section>
    <section className="ap-panel" aria-labelledby="ap-transactions-title">
      <header className="ap-panel-heading"><div><span className="ap-section-icon"><CreditCard size={18}/></span><h2 id="ap-transactions-title">Transactions</h2><span className="ap-count">{data.total}</span></div><span className="ap-panel-note">Historique des paiements test</span></header>
      <AdminAutoFiltersForm key={`${filters.q}:${filters.status}:${filters.from}:${filters.to}`} action="/admin/paiements" className="ap-filters">
        <label className="ap-search"><Search size={17}/><input type="search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Client, professionnel, intervention, référence…" aria-label="Rechercher une transaction"/></label>
        <label className="ap-date"><span><CalendarDays size={12}/>Du</span><input type="date" name="from" defaultValue={filters.from}/></label>
        <label className="ap-date"><span>Au</span><input type="date" name="to" defaultValue={filters.to}/></label>
        <label className="ap-filter-status"><span>Statut</span><select name="status" defaultValue={filters.status}><option value="ALL">Tous les statuts</option>{statuses.map(value => <option key={value} value={value}>{labels[value] ?? value}</option>)}</select></label>
        <button type="submit" className="admin-button admin-button-primary">Filtrer</button>
        {filtered && <Link href="/admin/paiements" className="ap-reset" aria-label="Réinitialiser les filtres" title="Réinitialiser les filtres"><RotateCcw size={16}/></Link>}
      </AdminAutoFiltersForm>
      {!data.rows.length ? <div className="ap-empty"><span><ReceiptText size={30} strokeWidth={1.5}/></span><h3>{filtered ? "Aucune transaction correspondante" : "Aucun paiement pour le moment"}</h3><p>{filtered ? "Modifiez la période, le statut ou votre recherche pour retrouver une transaction." : "Les premiers paiements test apparaîtront ici avec leur répartition financière."}</p>{filtered && <Link href="/admin/paiements" className="admin-button admin-button-light"><RotateCcw size={14}/>Réinitialiser les filtres</Link>}</div> : <div className="ap-table-scroll" role="region" aria-label="Tableau des transactions"><table className="ap-table"><thead><tr>{["Date", "Client", "Professionnel", "Intervention", "Montant payé", "Commission HomeFix", "Part professionnel", "Statut", "Actions"].map((heading, index) => <th scope="col" className={index >= 4 && index <= 6 ? "ap-numeric" : index === 8 ? "ap-actions-column" : undefined} key={heading}>{heading}</th>)}</tr></thead><tbody>{data.rows.map(payment => {
        const r = payment.invoice.quote.request, allocation = payment.allocation;
        return <tr key={payment.id}>
          <td data-label="Date" className="ap-date-cell"><time dateTime={new Date(payment.createdAt).toISOString()}>{shortDate(payment.createdAt)}</time><small>{time(payment.createdAt)}</small></td>
          <td data-label="Client"><Person person={r.client}/></td><td data-label="Professionnel"><Person person={r.professional} professional/></td>
          <td data-label="Intervention" className="ap-request-cell"><Link href={`/admin/demandes/${r.id}`} title={r.title}>{r.title}</Link><small>INT-{String(r.id).padStart(4, "0")}</small></td>
          <td data-label="Montant payé" className="ap-numeric"><strong className="ap-amount">{adminMoney(payment.amountMillimes)}</strong>{!["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status) && <small>Non encaissé</small>}{allocation && allocation.refundedMillimes > 0 && <small className="ap-refunded">−{adminMoney(allocation.refundedMillimes)} remboursés</small>}</td>
          <td data-label="Commission HomeFix" className="ap-numeric">{allocation ? <><strong className="ap-gain">{adminMoney(allocation.commissionMillimes - allocation.refundedCommissionMillimes)}</strong><small>{commissionLabel(allocation.commissionBps)}{allocation.historical ? " · historique" : ""}</small></> : <small>Après confirmation</small>}</td>
          <td data-label="Part professionnel" className="ap-numeric">{allocation ? <><strong>{adminMoney(allocation.professionalMillimes - allocation.refundedProfessionalMillimes)}</strong><small>{commissionLabel(10000 - allocation.commissionBps)}</small></> : <small>Après confirmation</small>}</td>
          <td data-label="Statut"><PaymentStatus status={payment.status}/>{payment.refund && <small className="ap-refund-state">Remb. : {labels[payment.refund.status] ?? payment.refund.status}</small>}</td>
          <td data-label="Actions" className="ap-actions-column"><PaymentActions payment={payment} onDetails={() => setSelected(payment)}/></td>
        </tr>;
      })}</tbody></table></div>}
      <footer className="ap-pagination"><span>{data.total ? `${(data.page - 1) * 20 + 1}–${Math.min(data.page * 20, data.total)} sur ${data.total}` : "0"} transaction{data.total > 1 ? "s" : ""}</span><nav aria-label="Pagination des transactions">{data.page > 1 ? <Link href={href(data.page - 1)} scroll={false}><ChevronLeft size={15}/>Précédent</Link> : <span aria-disabled="true"><ChevronLeft size={15}/>Précédent</span>}<span className="ap-page-number">{data.page} / {pages}</span>{data.page < pages ? <Link href={href(data.page + 1)} scroll={false}>Suivant<ChevronRight size={15}/></Link> : <span aria-disabled="true">Suivant<ChevronRight size={15}/></span>}</nav></footer>
    </section>
    <dialog ref={dialog} className="ap-dialog" aria-labelledby={titleId} onCancel={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSelected(null); } }}>
      {selected && request && <><header><span className="ap-section-icon"><ReceiptText size={22}/></span><div><span className="ap-dialog-eyebrow">DÉTAILS FINANCIERS</span><h2 id={titleId}>Détail de la transaction</h2></div><button type="button" className="ap-close" onClick={() => setSelected(null)} aria-label="Fermer les détails"><X size={19}/></button></header>
        <div className="ap-dialog-body"><div className="ap-dialog-amount"><span>Montant du paiement</span><strong>{adminMoney(selected.amountMillimes)}</strong><PaymentStatus status={selected.status}/></div>
          <div className="ap-dialog-people"><div><span>Client</span><Person person={request.client}/></div><div><span>Professionnel</span><Person person={request.professional} professional/></div></div>
          <dl className="ap-financial-lines"><div><dt>Intervention</dt><dd><Link href={`/admin/demandes/${request.id}`}>{request.title}<ArrowUpRight size={13}/></Link></dd></div><div><dt>Date de la transaction</dt><dd>{adminDate(selected.createdAt)}</dd></div>
            {a ? <><div><dt>Montant initial réparti</dt><dd>{adminMoney(a.grossMillimes)}</dd></div><div><dt>Commission HomeFix <span>{commissionLabel(a.commissionBps)}</span></dt><dd className="ap-gain">{adminMoney(a.commissionMillimes)}</dd></div><div><dt>Part professionnel <span>{commissionLabel(10000 - a.commissionBps)}</span></dt><dd>{adminMoney(a.professionalMillimes)}</dd></div>{a.refundedMillimes > 0 && <><div className="ap-refunded"><dt>Total remboursé</dt><dd>−{adminMoney(a.refundedMillimes)}</dd></div><div><dt>Commission annulée</dt><dd>−{adminMoney(a.refundedCommissionMillimes)}</dd></div><div><dt>Part professionnel annulée</dt><dd>−{adminMoney(a.refundedProfessionalMillimes)}</dd></div></>}<div className="ap-financial-total"><dt>Commission nette HomeFix</dt><dd>{adminMoney(a.commissionMillimes - a.refundedCommissionMillimes)}</dd></div><div className="ap-financial-total"><dt>Part nette professionnel</dt><dd>{adminMoney(a.professionalMillimes - a.refundedProfessionalMillimes)}</dd></div></> : <div><dt>Répartition</dt><dd>Disponible après confirmation</dd></div>}
          </dl>
          {a?.historical && <p className="ap-detail-note">Paiement antérieur · sans commission rétroactive.</p>}
          <p className="ap-detail-note">La part de cette transaction est affichée avant les éventuelles sanctions individuelles. Le solde global des professionnels tient compte des sanctions.</p>
        </div><footer>{receipt(selected) && <a className="admin-button admin-button-light" href={receipt(selected)!} target="_blank" rel="noreferrer"><FileText size={15}/>Consulter le reçu<ExternalLink size={12}/></a>}<button type="button" className="admin-button admin-button-primary" onClick={() => setSelected(null)}>Fermer</button></footer></>}
    </dialog>
  </AdminSection></div>;
}
