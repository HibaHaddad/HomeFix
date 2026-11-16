export const supportTopics = {
  intervention: "Intervention ou réservation", payment: "Paiement ou facture", profile: "Mon compte",
  review: "Avis", technical: "Problème technique", other: "Autre sujet",
};
export class SupportComplaintError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export type SupportIntervention = { id: number; title: string; professional: string; createdAt: string };
export type ClientSupportComplaint = {
  id: number; subject: string; message: string; status: string; response: string | null; createdAt: string; updatedAt: string;
  request: { title: string; professional: { name: string; businessName: string | null } } | null;
  attachments: { id: number; name: string; size: number }[];
};
export type ClientSupportPage = { items: ClientSupportComplaint[]; nextCursor: number | null };
export const SUPPORT_FILE_LIMIT = 5 * 1024 * 1024;
export const SUPPORT_TOTAL_LIMIT = 10 * 1024 * 1024;
export function validateSupportComplaint(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SupportComplaintError("Demande invalide.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["type", "category", "requestId", "subject", "message"].includes(key))) throw new SupportComplaintError("Champs non autorisés.");
  const type = input.type ?? "complaint", category = input.category ?? "other";
  if (!["help", "complaint"].includes(String(type))) throw new SupportComplaintError("Type de demande invalide.");
  if (!Object.hasOwn(supportTopics, String(category))) throw new SupportComplaintError("Choisissez une catégorie de demande.");
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (subject.length < 5 || subject.length > 150) throw new SupportComplaintError("Le sujet doit contenir entre 5 et 150 caractères.");
  if (message.length < 20 || message.length > 3000) throw new SupportComplaintError("Le message doit contenir entre 20 et 3 000 caractères.");
  let requestId: number | null = null;
  if (input.requestId !== undefined && input.requestId !== null && input.requestId !== "") {
    if (!(typeof input.requestId === "number" || typeof input.requestId === "string" && /^\d+$/.test(input.requestId))) throw new SupportComplaintError("Intervention invalide.");
    requestId = Number(input.requestId);
    if (!Number.isSafeInteger(requestId) || requestId < 1 || requestId > 2147483647) throw new SupportComplaintError("Intervention invalide.");
  }
  if (type === "complaint" && category === "intervention" && !requestId) throw new SupportComplaintError("Sélectionnez l’intervention et le professionnel concernés.");
  return { requestId, subject, message: input.type !== undefined || input.category !== undefined ? `${type === "help" ? "Demande d’aide" : "Réclamation"} · ${supportTopics[category as keyof typeof supportTopics]}\n\n${message}` : message };
}
