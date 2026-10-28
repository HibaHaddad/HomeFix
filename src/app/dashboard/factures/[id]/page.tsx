import { notFound } from "next/navigation";
import { getClient } from "@/app/lib/client-access";
import { prisma } from "@/app/lib/prisma";
import { money, dateLabel } from "@/lib/client-domain";
import PrintInvoice from "@/components/client/PrintInvoice";
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const client = await getClient(); if (!client) notFound();
  const invoiceId = Number((await params).id); if (!Number.isSafeInteger(invoiceId) || invoiceId < 1) notFound();
  const invoice = await prisma.clientInvoice.findFirst({ where: { id: invoiceId, quote: { request: { clientId: client.id } } }, include: { quote: { include: { request: { select: { title: true, address: true, professional: { select: { name: true, businessName: true } } } } } } } });
  if (!invoice) notFound();
  const r = invoice.quote.request;
  return <article className="cx-panel cx-invoice-print"><div className="cx-panel-title"><h1>HomeFix TN</h1><PrintInvoice/></div><span className="cx-eyebrow">FACTURE HF-{String(invoice.id).padStart(6, "0")}</span><h2>{r.title}</h2><p>Émise le {dateLabel(invoice.createdAt)}</p><p>Client : {client.name}<br/>Adresse : {r.address}<br/>Professionnel : {r.professional?.businessName || r.professional?.name}</p><p className="cx-pre-wrap">{invoice.quote.details}</p><dl className="cx-invoice-lines"><div><dt>Prix convenu</dt><dd>{money(invoice.totalMillimes)}</dd></div><div><dt>Acompte de 50 %</dt><dd>{money(invoice.depositMillimes)}</dd></div><div><dt>Montant encaissé</dt><dd>{money(invoice.paidMillimes)}</dd></div><div><dt>Solde à régler</dt><dd>{money(invoice.totalMillimes - invoice.paidMillimes)}</dd></div></dl><p><strong>En cas d’absence du professionnel, l’acompte doit être remboursé au client après vérification de l’absence.</strong></p><p>Document de suivi du prix convenu. Le paiement en ligne est indisponible ; ce document ne vaut pas reçu de paiement.</p></article>;
}
