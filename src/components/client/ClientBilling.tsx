"use client";
import Link from "next/link";
import { CreditCard, FileCheck2, Star } from "lucide-react";
import type { WorkspaceData } from "@/app/lib/client-workspace";
import { dateLabel, money } from "@/lib/client-domain";
import FinishIntervention from "./FinishIntervention";
import ReviewEditor from "./ReviewEditor";
export function ClientPayments({ requests }: { requests: WorkspaceData["requests"] }) {
  const invoices = requests.flatMap((r) => r.quotes.filter((q) => q.invoice).map((q) => ({ r, invoice: q.invoice! })));
  if (!invoices.length) return <section className="cx-empty"><CreditCard size={28}/><h2>Aucun règlement pour le moment.</h2><p>Le prix accepté et le reçu de chaque intervention apparaîtront ici.</p></section>;
  return <div className="cx-stack">{invoices.map(({ r, invoice }) => <section className="cx-panel" key={invoice.id}><div className="cx-panel-title"><h2>{r.title}</h2><span className={invoice.status === "PAID" ? "hf-paid" : "cx-badge"}>{invoice.status === "PAID" ? (invoice.testPaid ? "Payé " : "Payé") : "À régler"}</span></div><p>{r.professional.businessName || r.professional.name}</p><dl className="cx-invoice-lines"><div><dt>Prix final accepté</dt><dd>{money(invoice.totalMillimes)}</dd></div><div><dt>Montant payé</dt><dd>{money(invoice.paidMillimes)}</dd></div></dl>{invoice.paidAt && <p>Réglé le {dateLabel(invoice.paidAt)}</p>}<div className="cx-actions">{r.status === "COMPLETED" && <FinishIntervention requestId={r.id} paid={invoice.status === "PAID"} testPaid={invoice.testPaid} confirmed={Boolean(r.clientConfirmedAt)}/>}{invoice.status === "PAID" ? <a className="cx-text-btn" href={`/api/client/factures/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer"><FileCheck2 size={16}/>Reçu de paiement</a> : <Link className="cx-text-btn" href={`/dashboard/factures/${invoice.id}`}><FileCheck2 size={16}/>Voir la facture</Link>}</div></section>)}</div>;
}
export function ClientReviews({ requests }: { requests: WorkspaceData["requests"] }) {
  const eligible = requests.filter((r) => r.review || (r.status === "COMPLETED" && r.quotes.some((q) => q.status === "ACCEPTED" && q.invoice?.status === "PAID")));
  if (!eligible.length) return <section className="cx-empty"><Star size={28}/><h2>Votre expérience compte.</h2><p>Après le paiement confirmé d’une intervention terminée, vous pourrez laisser une note ou un commentaire.</p><Link className="cx-btn" href="/dashboard/interventions">Voir mes interventions</Link></section>;
  return <div className="cx-stack">{eligible.map((r) => <section className="cx-panel" key={r.id}><div className="cx-panel-title"><h2>{r.title}</h2><Star size={20}/></div><p>{r.professional.businessName || r.professional.name}</p><ReviewEditor requestId={r.id} review={r.review}/></section>)}</div>;
}
