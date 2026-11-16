export const sanctionLabels: Record<string, string> = { LATE: "Retard à l’intervention", NO_SHOW: "Absence au rendez-vous", UNPERFORMED: "Intervention non réalisée", PENDING: "À valider", APPLIED: "Appliquée", REJECTED: "Refusée", REVOKED: "Annulée", NONE: "Aucune", OPEN: "À examiner", UPHELD: "Sanction maintenue", ACCEPTED: "Contestation acceptée" };
export type SanctionRuleInput = { id: string; enabled: boolean; thresholdMinutes: number; amountMillimes: number; ratingHundredths: number };
export function validateSanctionRules(value: unknown): SanctionRuleInput[] {
  if (!Array.isArray(value) || value.length !== 3) throw new Error("Les trois règles sont requises.");
  const seen = new Set<string>();
  return value.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some(key => !["id","enabled","thresholdMinutes","amountMillimes","ratingHundredths"].includes(key))) throw new Error("Règle invalide.");
    const r = row as SanctionRuleInput;
    if (!["LATE","NO_SHOW","UNPERFORMED"].includes(r.id) || seen.has(r.id) || typeof r.enabled !== "boolean") throw new Error("Règle invalide ou dupliquée.");
    seen.add(r.id);
    for (const [key, max] of [["thresholdMinutes",10080],["amountMillimes",1000000],["ratingHundredths",400]] as const) if (!Number.isInteger(r[key]) || r[key] < 0 || r[key] > max) throw new Error("Seuil ou pénalité invalide.");
    if (r.id === "LATE" ? r.ratingHundredths < 1 || r.amountMillimes !== 0 : r.amountMillimes < 1 || r.ratingHundredths !== 0) throw new Error("Le retard réduit la note ; les autres règles utilisent une pénalité financière.");
    return { id: r.id, enabled: r.enabled, thresholdMinutes: r.thresholdMinutes, amountMillimes: r.amountMillimes, ratingHundredths: r.ratingHundredths };
  });
}
export function adjustedRating(original: number | null, penaltyHundredths: number) { return original === null ? null : Math.max(1, Math.min(5, original - penaltyHundredths / 100)); }
export function sanctionPenalty(row: { amountMillimes: number; ratingHundredths: number }) {
  return row.amountMillimes ? `${new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3 }).format(row.amountMillimes / 1000)} DT` : `${row.ratingHundredths / 100} étoile${row.ratingHundredths > 100 ? "s" : ""}`;
}
