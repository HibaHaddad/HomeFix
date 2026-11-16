import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import { createReceiptPdf } from "@/app/lib/receipt-pdf";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401, headers });
  const pro = await prisma.user.findFirst({ where: { id: session.userId, role: "PROFESSIONAL", status: "APPROVED", isSuspended: false }, select: { id: true, name: true, businessName: true } });
  if (!pro) return Response.json({ error: "Accès réservé au professionnel." }, { status: 403, headers });
  const id = (await params).id;
  if (!/^[a-f0-9-]{36}$/.test(id)) return Response.json({ error: "Reçu introuvable." }, { status: 404, headers });
  const payment = await prisma.checkoutPayment.findFirst({ where: { id, livemode: false, allocation: { professionalId: pro.id }, invoice: { quote: { request: { professionalId: pro.id } } } }, include: { allocation: true, invoice: { include: { quote: { include: { request: { select: { title: true, address: true, client: { select: { name: true } } } } } } } } } });
  if (!payment?.allocation) return Response.json({ error: "Reçu introuvable." }, { status: 404, headers });
  const invoice = payment.invoice, request = invoice.quote.request;
  const pdf = await createReceiptPdf({ ...invoice, createdAt: payment.allocation.createdAt, client: request.client.name, title: request.title, address: request.address, professional: pro.businessName || pro.name, details: invoice.quote.details, allocation: payment.allocation });
  return new Response(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=homefix-recu-professionnel.pdf" } });
}
