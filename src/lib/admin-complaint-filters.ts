export const complaintStatuses = { OPEN: "En attente", IN_PROGRESS: "En cours de traitement", RESOLVED: "Résolue", CLOSED: "Clôturée" };
export const complaintPriorities = { LOW: "Basse", NORMAL: "Normale", HIGH: "Haute", URGENT: "Urgente" };
export const complaintRoles = { CLIENT: "Client", PROFESSIONAL: "Prestataire", ADMIN: "Administrateur" };
export type AdminComplaintFilters = { q: string; status: string; priority: string; role: string; from: string; to: string; sort: "newest" | "oldest"; page: number };
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? value : "";
}
export function parseAdminComplaintFilters(params: Record<string, string | string[] | undefined>): AdminComplaintFilters {
  const first = (key: string) => { const value = params[key]; return Array.isArray(value) ? value[0] ?? "" : value ?? ""; };
  const choice = (key: string, options: object) => Object.keys(options).includes(first(key)) ? first(key) : "ALL";
  const page = /^\d+$/.test(first("page")) ? Number(first("page")) : 1;
  const from = validDate(first("from")), to = validDate(first("to"));
  return { q: first("q").trim().slice(0, 120), status: first("status").trim().slice(0, 80) || "ALL", priority: choice("priority", complaintPriorities), role: choice("role", complaintRoles), from, to: from && to && to < from ? from : to, sort: first("sort") === "oldest" ? "oldest" : "newest", page: Number.isSafeInteger(page) && page >= 1 && page <= 100000 ? page : 1 };
}
export function complaintDateRange(filters: Pick<AdminComplaintFilters, "from" | "to">) {
  // Inclusive local dates in Africa/Tunis, UTC+01:00.
  return { ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00+01:00`) } : {}), ...(filters.to ? { lt: new Date(+new Date(`${filters.to}T00:00:00+01:00`) + 86400000) } : {}) };
}
