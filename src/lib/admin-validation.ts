export class AdminActionError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function adminId(value: string) {
  if (!/^\d+$/.test(value)) throw new AdminActionError("Identifiant invalide.");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new AdminActionError("Identifiant invalide.");
  return id;
}
export function adminText(value: unknown, label: string, min = 3, max = 1000) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new AdminActionError(`${label} : entre ${min} et ${max} caractères requis.`);
  return value.trim();
}
export function adminObject(value: unknown, allowed: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw new AdminActionError("Champs invalides.");
  return value as Record<string, unknown>;
}
export function adminPage(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 && n <= 100000 ? n : 1;
}
export const sanctionDefaults = { reviewThreshold: 2, absenceThreshold: 3, paymentDelayDays: 14, warningPoints: 1, suspensionPoints: 5 };
export function validateSanctions(value: unknown) {
  const input = adminObject(value, Object.keys(sanctionDefaults));
  const result = { ...sanctionDefaults };
  for (const key of Object.keys(result) as (keyof typeof result)[]) {
    const n = input[key];
    const max = key === "reviewThreshold" ? 5 : key === "paymentDelayDays" ? 365 : 100;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > max) throw new AdminActionError(`Valeur invalide : ${key}.`);
    result[key] = n;
  }
  if (result.suspensionPoints <= result.warningPoints) throw new AdminActionError("Le seuil de suspension doit dépasser celui de l’avertissement.");
  return result;
}
