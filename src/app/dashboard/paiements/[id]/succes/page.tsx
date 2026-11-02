import PaymentRequestPage from "@/components/client/PaymentRequestPage";

export default async function PaymentSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  return <PaymentRequestPage id={(await params).id} returned/>;
}
