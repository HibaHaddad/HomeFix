import HomeFixBrand from "@/components/HomeFixBrand";
import { notFound, redirect } from "next/navigation";
import { getClient } from "@/app/lib/client-access";
import { prisma } from "@/app/lib/prisma";
import { money, dateLabel } from "@/lib/client-domain";
import PrintInvoice from "@/components/client/PrintInvoice";
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const client = await getClient(); if (!client) notFound();
  const invoiceId = Number((await params).id); if (!Number.isSafeInteger(invoiceId) || invoiceId < 1) notFound();
  const invoice = await prisma.clientInvoice.findFirst({ where: { id: invoiceId, quote: { request: { clientId: client.id } } }, include: { payments: { where: { status: "SUCCEEDED", livemode: false }, orderBy: { createdAt: "desc" }, take: 1 }, quote: { include: { request: { select: { title: true, address: true, professional: { select: { name: true, businessName: true } } } } } } } });
  if (!invoice) notFound();
  if (invoice.status === "PAID") redirect(`/api/client/factures/${invoice.id}/pdf`);
  const r = invoice.quote.request;
  return <article className="cx-panel cx-invoice-print"><div className="cx-panel-title"><HomeFixBrand/><PrintInvoice/></div><span className="cx-eyebrow">{invoice.status === "PAID" ? "REÇU DE PAIEMENT" : "FACTURE"}</span><h2>{r.title}</h2><p>Émise le {dateLabel(invoice.createdAt)}</p><p>Client : {client.name}<br/>Adresse : {r.address}<br/>Professionnel : {r.professional?.businessName || r.professional?.name}</p><p className="cx-pre-wrap">{invoice.quote.details}</p><dl className="cx-invoice-lines"><div><dt>Prix final accepté</dt><dd>{money(invoice.totalMillimes)}</dd></div><div><dt>{invoice.testPaid ? "Montant validé en test" : "Montant encaissé"}</dt><dd>{money(invoice.paidMillimes)}</dd></div><div><dt>Solde à régler</dt><dd>{money(invoice.totalMillimes - invoice.paidMillimes)}</dd></div></dl>{invoice.status === "PAID" ? <>{invoice.paidAt && <p>Réglé le {dateLabel(invoice.paidAt)}</p>}{invoice.receiptNumber && <p>Référence du reçu : {invoice.receiptNumber}</p>}</> : <p>Cette facture présente le prix accepté. Elle ne vaut pas reçu de paiement avant confirmation du règlement.</p>}</article>;
}
