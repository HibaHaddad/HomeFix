export const interventionSteps = [
  "Demande envoyée", "Devis reçu", "Prix accepté", "RDV confirmé",
  "En route", "Intervention en cours", "Terminée",
] as const;

type TrackingRequest = {
  status: string;
  booking: { status: string } | null;
  quotes: { status: string }[];
  events: { status: string }[];
};
const stages: Record<string, number> = { SENT: 0, QUOTED: 1, PRICE_ACCEPTED: 2, BOOKED: 3, EN_ROUTE: 4, IN_PROGRESS: 5, COMPLETED: 6 };

export function getInterventionProgress(request: TrackingRequest) {
  const stopped = request.status === "CANCELLED" ? "cancelled" : request.status === "REJECTED" ? "rejected" : null;
  const evidence = request.booking?.status === "CONFIRMED" ? 3 : request.quotes.some((q) => q.status === "ACCEPTED") ? 2 : request.quotes.length ? 1 : 0;
  // Active requests use their current state, never the furthest historical state:
  // a changed/cancelled slot must not keep showing an obsolete confirmed RDV.
  const index = stopped
    ? Math.max(evidence, ...request.events.map((event) => stages[event.status] ?? 0))
    : stages[request.status] ?? evidence;
  return { index, stopped, finished: request.status === "COMPLETED", label: stopped === "cancelled" ? "Annulée" : stopped === "rejected" ? "Refusée" : interventionSteps[index] };
}
