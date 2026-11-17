import { requireAdmin } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";
import { createReceiptPdf } from "@/app/lib/receipt-pdf";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (access.error) {
    for (const [name, value] of Object.entries(headers)) access.error.headers.set(name, value);
    return access.error;
  }
  const id = (await params).id;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) {
    return Response.json({ error: "Reçu introuvable." }, { status: 404, headers });
  }
  const payment = await prisma.checkoutPayment.findFirst({
    where: { id, livemode: false, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] }, paymentIntentId: { not: null } },
    include: {
      allocation: true,
      invoice: { include: { quote: { include: { request: { select: {
        title: true, address: true,
        client: { select: { name: true } },
        professional: { select: { name: true, businessName: true } },
      } } } } } },
    },
  });
  if (!payment) return Response.json({ error: "Reçu introuvable." }, { status: 404, headers });

  const { invoice, allocation } = payment;
  const request = invoice.quote.request;
  // Use this payment's amounts and reference, even when an invoice has several attempts.
  const paidAt = allocation?.createdAt ?? (invoice.paymentReference === payment.paymentIntentId ? invoice.paidAt : null);
  const pdf = await createReceiptPdf({
    ...invoice,
    createdAt: allocation?.createdAt ?? payment.createdAt,
    paidAt,
    totalMillimes: payment.amountMillimes,
    paidMillimes: payment.amountMillimes,
    receiptNumber: invoice.paymentReference === payment.paymentIntentId ? invoice.receiptNumber || payment.paymentIntentId : payment.paymentIntentId,
    testPaid: true,
    client: request.client.name,
    professional: request.professional.businessName || request.professional.name,
    title: request.title,
    address: request.address || "",
    details: invoice.quote.details,
    ...(allocation ? { allocation } : {}),
  });
  return new Response(new Uint8Array(pdf), { headers: {
    ...headers,
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="homefix-recu-${id}.pdf"`,
  } });
}
