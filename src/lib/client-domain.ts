export const categories = ["Plomberie", "Électricité", "Climatisation", "Chauffage", "Serrurerie", "Maçonnerie", "Peinture", "Menuiserie", "Nettoyage", "Électroménager", "Autres"] as const;
export const statusLabels: Record<string, string> = { SENT: "Demande envoyée", QUOTED: "Devis reçu", PRICE_ACCEPTED: "Prix accepté", BOOKED: "Rendez-vous confirmé", EN_ROUTE: "En route", IN_PROGRESS: "En cours", COMPLETED: "Terminée", CANCELLED: "Annulée", PENDING: "À examiner", ACCEPTED: "Accepté", REJECTED: "Refusé", NEGOTIATING: "En négociation", SUPERSEDED: "Remplacé", PROPOSED: "À confirmer", CONFIRMED: "Confirmé", UNPAID: "À régler", PAID: "Payée", OPEN: "Ouverte", RESOLVED: "Résolue", NORMAL: "Normale", SOON: "Sous 48 h", URGENT: "Urgente" };
export const money = (millimes: number) => new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND" }).format(millimes / 1000);
export const dateLabel = (date: string | Date) => new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" }).format(new Date(date));
export function text(value: unknown, label: string, min = 1, max = 3000): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new Error(`${label} : entre ${min} et ${max} caractères.`);
  return value.trim();
}
export function id(value: unknown): number {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > 2147483647) throw new Error("Identifiant invalide.");
  return parsed;
}
export function amount(value: unknown): number {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+(\.\d{1,3})?$/.test(String(value))) throw new Error("Montant invalide (3 décimales maximum).");
  const millimes = Math.round(Number(value) * 1000);
  if (millimes < 1000 || millimes > 1000000000) throw new Error("Montant entre 1 et 1 000 000 TND.");
  return millimes;
}
export function deposit(total: number) { return Math.ceil(total / 2); }
export function coordinates(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Coordonnées GPS invalides.");
  return { latitude, longitude };
}
export function bookingDates(start: unknown, end: unknown, now = Date.now()) {
  const tunisDate = (value: unknown, label: string) => { const s = text(value, label, 10, 40); return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00+01:00` : s); };
  const startsAt = tunisDate(start, "Date de début");
  const endsAt = tunisDate(end, "Date de fin");
  if (!Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || +startsAt <= now || +endsAt <= +startsAt || +endsAt - +startsAt > 86400000) throw new Error("Choisissez un créneau futur de 24 heures maximum.");
  return { startsAt, endsAt };
}
export function nextProfessionalStatus(current: string, next: string) {
  const transitions: Record<string, string> = { BOOKED: "EN_ROUTE", EN_ROUTE: "IN_PROGRESS", IN_PROGRESS: "COMPLETED" };
  if (transitions[current] !== next) throw new Error("Ce changement de statut n’est pas autorisé.");
  return next;
}
