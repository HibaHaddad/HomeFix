import { getClient } from "@/app/lib/client-access";
import { prisma } from "@/app/lib/prisma";
import { createReceiptPdf } from "@/app/lib/receipt-pdf";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401, headers: privateHeaders });
  const invoiceId = Number((await params).id);
  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) return Response.json({ error: "Reçu introuvable." }, { status: 404, headers: privateHeaders });
  const invoice = await prisma.clientInvoice.findFirst({ where: { id: invoiceId, status: "PAID", quote: { request: { clientId: client.id } } }, include: { quote: { include: { request: { select: { title: true, address: true, professional: { select: { name: true, businessName: true } } } } } } } });
  if (!invoice) return Response.json({ error: "Reçu introuvable." }, { status: 404, headers: privateHeaders });
  const r = invoice.quote.request;
  const pdf = await createReceiptPdf({ ...invoice, client: client.name, title: r.title, address: r.address || "", professional: r.professional.businessName || r.professional.name, details: invoice.quote.details });
  return new Response(new Uint8Array(pdf), { headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="homefix-recu-${invoice.id}.pdf"` } });
}
