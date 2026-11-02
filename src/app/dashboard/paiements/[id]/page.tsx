import PaymentRequestPage from "@/components/client/PaymentRequestPage";
export default async function PaymentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retour?: string; carte?: string }> }) {
  const query = await searchParams;
  return <PaymentRequestPage id={(await params).id} startPayment={query.carte === "1"} cancelled={query.retour === "annule"} returned={query.retour === "succes"}/>;
}
