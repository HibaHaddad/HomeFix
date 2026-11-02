import { getClient } from "@/app/lib/client-access";
import { checkoutPlan, ownedPaymentRequest, PaymentError, stripeEligibility } from "@/app/lib/stripe-payments";
import { createCardPayment } from "@/app/lib/card-payments";
import { prisma } from "@/app/lib/prisma";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { id } from "@/lib/client-domain";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
function failure(e: unknown) {
  if (e instanceof PaymentError) return Response.json({ error: e.message }, { status: e.status, headers });
  // Stripe errors often have name="Error". Keep useful diagnostics without
  // logging their message, request payload, API keys or client secrets.
  const details = e && typeof e === "object" ? e as Record<string, unknown> : {};
  const diagnostic = Object.fromEntries(["type", "code", "param", "requestId"].flatMap((key) => typeof details[key] === "string" && /^[\w.\[\]-]{1,160}$/.test(details[key] as string) ? [[key, details[key]]] : []));
  console.error("Card payment unavailable", { name: e instanceof Error ? e.name : "Unknown", ...diagnostic });
  if (details.type === "StripeIdempotencyError") return Response.json({ error: "Une ancienne tentative de paiement doit être vérifiée avant de réessayer. Aucun nouveau paiement n’a été créé.", code: "PAYMENT_ATTEMPT_CONFLICT" }, { status: 409, headers });
  return Response.json({ error: "La vérification du paiement est indisponible. Réessayez sans effectuer un autre règlement." }, { status: 503, headers });
}
export async function GET(request: Request) {
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401 });
  let requestId: number;
  try { requestId = id(new URL(request.url).searchParams.get("requestId")); } catch { return Response.json({ error: "Intervention invalide." }, { status: 400 }); }
  try {
    const r = await ownedPaymentRequest(client.id, requestId), invoice = r.quotes[0]?.invoice;
    let available = false, reason = "";
    const attempt = invoice ? await prisma.checkoutPayment.findFirst({ where: { invoiceId: invoice.id }, orderBy: { createdAt: "desc" }, select: { currency: true, stripeAmount: true, exchangeRatePpm: true, amountMillimes: true, priorPaidMillimes: true, livemode: true, status: true } }) : null;
    let conversion = attempt && !attempt.livemode && !["EXPIRED", "FAILED"].includes(attempt.status) ? { currency: attempt.currency, stripeAmount: attempt.stripeAmount ?? attempt.amountMillimes, exchangeRatePpm: attempt.exchangeRatePpm ?? 1000000, balanceMillimes: attempt.amountMillimes, priorPaidMillimes: attempt.priorPaidMillimes } : null;
    if (invoice?.status !== "PAID") {
      try {
        const eligible = await stripeEligibility();
        if (!invoice || r.quotes.length !== 1 || invoice.totalMillimes !== r.quotes[0].amountMillimes || r.status !== "COMPLETED") throw new PaymentError("Le paiement sera disponible après la fin de l’intervention et l’acceptation du prix.");
        const balance = invoice.totalMillimes - invoice.paidMillimes;
        if (!conversion) conversion = { ...checkoutPlan(eligible.supportedCurrencies, balance), balanceMillimes: balance, priorPaidMillimes: invoice.paidMillimes };
        if (attempt?.livemode || !eligible.supportedCurrencies.includes(conversion.currency) || conversion.balanceMillimes !== balance || conversion.priorPaidMillimes !== invoice.paidMillimes) throw new PaymentError("La session existante doit être vérifiée avant une nouvelle tentative.");
        available = true;
      } catch (e) { reason = e instanceof PaymentError ? e.message : "La compatibilité du compte Stripe Test ne peut pas être vérifiée pour le moment."; }
    }
    return Response.json({ requestId, mode: "test", testPaid: invoice?.testPaid || false, checkoutStatus: attempt?.status, title: r.title, professional: r.professional.businessName || r.professional.name, status: invoice?.status || "UNPAID", totalMillimes: invoice?.totalMillimes, paidMillimes: invoice?.paidMillimes || 0, balanceMillimes: invoice ? Math.max(0, invoice.totalMillimes - invoice.paidMillimes) : undefined, paidAt: invoice?.paidAt, receiptUrl: invoice?.status === "PAID" ? invoice.receiptUrl : null, invoiceId: invoice?.id, available, reason }, { headers });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401 });
  let requestId: number;
  try {
    const body = await request.json();
    if (Object.keys(body).some((key) => key !== "requestId")) throw new Error();
    requestId = id(body.requestId);
  } catch { return Response.json({ error: "Requête invalide. Le montant est déterminé par le serveur." }, { status: 400 }); }
  try { return Response.json(await createCardPayment(client.id, requestId), { headers }); } catch (e) { return failure(e); }
}
