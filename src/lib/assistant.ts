import type { DirectoryProfessional } from "@/app/lib/professional-directory";
import { categories } from "./client-domain";

export type AssistantAnalysis = { category: string; urgency: "NORMAL" | "SOON" | "URGENT"; description: string };
export type AssistantSearch = { category: string; city: string; budget: number | null };
export type AssistantProfessional = DirectoryProfessional & {
  nextSlot: string | null; reasons: string[];
  match?: { locationConfirmed: boolean; budget: "WITHIN" | "OVER" | "UNKNOWN" | "UNSPECIFIED" };
};
export type AssistantMessage = {
  role: "user" | "assistant"; text: string; createdAt: string;
  analysis?: AssistantAnalysis; professionalIds?: number[];
  professionals?: AssistantProfessional[]; searched?: boolean;
  searchCriteria?: AssistantSearch;
};
export type AssistantConversationSummary = { id: string; title: string; createdAt: string; updatedAt: string };
export type AssistantThread = { id: string | null; title?: string; messages: AssistantMessage[]; enabled: boolean };
export type AssistantConversationList = { conversations: AssistantConversationSummary[]; nextCursor: string | null };
export class AssistantError extends Error {
  status: number;
  retryAfter?: number;
  constructor(message: string, status = 502, retryAfter?: number) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AssistantError("Réponse de l’assistant invalide.");
  return value as Record<string, unknown>;
}
export function boundedText(value: unknown, max: number, min = 1): string {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) throw new AssistantError("Texte invalide.", 400);
  return value.trim();
}
export function parseAnalysis(value: unknown): AssistantAnalysis {
  const data = object(value);
  if (!(categories as readonly unknown[]).includes(data.category) || !["NORMAL", "SOON", "URGENT"].includes(String(data.urgency))) throw new AssistantError("Analyse invalide.");
  return { category: data.category as string, urgency: data.urgency as AssistantAnalysis["urgency"], description: boundedText(data.description, 2000) };
}
export function parseSearch(value: unknown) {
  const data = object(value);
  const category = boundedText(data.category, 80), city = boundedText(data.city, 100);
  if (!(categories as readonly string[]).includes(category) || category === "Autres") throw new AssistantError("Précisez la spécialité.", 400);
  if (data.budget !== null && (typeof data.budget !== "number" || !Number.isFinite(data.budget) || data.budget < 0 || data.budget > 1000000)) throw new AssistantError("Budget invalide.", 400);
  return { category, city, budget: data.budget as number | null };
}
export const normalize = (value: string) => value.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
// Conservative first-line protection also runs when the provider is unavailable.
export function safetyAdvice(text: string): string | null {
  const t = normalize(text);
  if (/\b(gaz|butane|propane|monoxyde|co)\b/.test(t) && /odeur|sent|sens|fui|siff|intoxic|vertige|malaise|detect|alarme/.test(t)) return "Danger potentiel lié au gaz : quittez les lieux et éloignez les autres personnes. N’actionnez aucun interrupteur, appareil, téléphone ou flamme à l’intérieur. Depuis l’extérieur, contactez les secours locaux ou le service d’urgence de votre fournisseur de gaz. Ne rentrez pas avant leur autorisation. Une recherche de professionnel ne remplace pas les secours.";
  if (/electrocut|electris|etincelle|fumee|incendie|fil(s)? denude|prise.*brul|odeur.*brul|eau.*(prise|tableau|electri)/.test(t)) return "Danger électrique ou départ de feu possible : éloignez-vous de l’installation, ne touchez aucun fil, appareil ou personne encore en contact avec le courant et n’utilisez pas d’eau. Évacuez en cas de fumée ou de feu et contactez les secours depuis un endroit sûr. Faites intervenir un électricien qualifié avant toute remise en service.";
  return null;
}
export function rankProfessional(p: AssistantProfessional, budget: number | null) {
  // Match tiers are sorted first; published facts then rank profiles within each tier.
  return (p.nextSlot ? 25 : 0) + (p.availability === "AVAILABLE" ? 8 : p.availability === "THIS_WEEK" ? 4 : 0)
    + (p.rating ?? 0) * 5 + Math.min(p.reviewCount, 20) / 2 + Math.min(p.experienceYears ?? 0, 20)
    + (budget !== null && p.priceMin !== null && p.priceMin <= budget ? 15 : 0);
}

export function describeAssistantMatch(p: AssistantProfessional, input: AssistantSearch): AssistantProfessional {
  const area = normalize(`${p.serviceCity ?? ""} ${p.coveredAreas ?? ""}`);
  const locationConfirmed = area.includes(normalize(input.city)) || /toute la tunisie|toute tunisie|tout le territoire|national/.test(area);
  const budget = input.budget === null ? "UNSPECIFIED" : p.priceMin === null ? "UNKNOWN" : p.priceMin > input.budget ? "OVER" : "WITHIN";
  return { ...p, match: { locationConfirmed, budget }, reasons: [
    "Spécialité correspondante",
    locationConfirmed ? `Zone déclarée compatible avec ${input.city}` : `Intervention à ${input.city} à confirmer : zone déclarée ${p.serviceCity || p.coveredAreas || "non renseignée"}`,
    ...(budget === "OVER" ? ["Tarif de départ supérieur à votre budget"] : budget === "UNKNOWN" ? ["Tarif non renseigné : demander un devis"] : budget === "WITHIN" ? ["Tarif de départ compatible avec votre budget — devis final à confirmer"] : []),
  ] };
}
export function assistantMatchTier(p: AssistantProfessional) {
  return (p.match?.locationConfirmed ? 0 : 2) + (p.match?.budget === "OVER" ? 1 : 0);
}
export function recommendationText(people: AssistantProfessional[], criteria?: AssistantSearch) {
  if (!people.length) return `Aucun professionnel approuvé de cette spécialité ne déclare actuellement intervenir ${criteria ? `à ${criteria.city}` : "dans votre ville"} dans l’annuaire HomeFix TN. Vous pouvez vérifier la ville enregistrée dans Mon profil ou consulter à nouveau l’annuaire plus tard.`;
  if (people.some((p) => p.match && assistantMatchTier(p) === 0)) return "Voici les professionnels inscrits et approuvés sur HomeFix TN pour cette spécialité et votre zone. Consultez leurs profils ci-dessous ; le prix final et le rendez-vous restent à confirmer avec eux.";
  return "Voici les professionnels inscrits et approuvés sur HomeFix TN pour cette spécialité et votre ville. Leurs tarifs de départ dépassent le budget indiqué ; cet écart est signalé sur chaque carte. Demandez un devis pour connaître le prix final.";
}
