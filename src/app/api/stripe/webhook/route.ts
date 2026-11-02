import { handleStripeEvent, stripeClient } from "@/app/lib/stripe-payments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "Webhook indisponible." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Signature requise." }, { status: 400 });
  if (Number(request.headers.get("content-length") || 0) > 1048576) return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 1048576) return new Response(null, { status: 413 });
  let event;
  try { event = stripeClient().webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return Response.json({ error: "Signature Stripe invalide." }, { status: 400 }); }
  if (event.livemode) return Response.json({ error: "Seuls les événements Stripe Test sont autorisés." }, { status: 400 });
  try { await handleStripeEvent(event); return Response.json({ received: true }); }
  catch (e) { console.error("Stripe webhook processing failed", event.id, e instanceof Error ? e.name : "Unknown"); return Response.json({ error: "Traitement à réessayer." }, { status: 500 }); }
}
