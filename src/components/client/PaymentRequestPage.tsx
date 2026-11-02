import { notFound } from "next/navigation";
import { getClient } from "@/app/lib/client-access";
import { ownedPaymentRequest } from "@/app/lib/stripe-payments";
import PaymentResult from "./PaymentResult";

export default async function PaymentRequestPage({ id, startPayment = false, cancelled = false, returned = false }: { id: string; startPayment?: boolean; cancelled?: boolean; returned?: boolean }) {
  const client = await getClient();
  if (!client) notFound();
  const requestId = Number(id);
  if (!Number.isSafeInteger(requestId) || requestId <= 0) notFound();
  const record = await ownedPaymentRequest(client.id, requestId).catch(() => null);
  if (!record || record.status !== "COMPLETED") notFound();
  // A return URL never settles the invoice. PaymentResult reads webhook state.
  return <PaymentResult requestId={requestId} startPayment={startPayment} cancelled={cancelled} returned={returned} review={record.review ? { rating: record.review.rating, comment: record.review.comment, createdAt: record.review.createdAt.toISOString(), published: record.review.published } : null}/>;
}
