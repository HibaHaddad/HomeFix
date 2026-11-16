import { adminObject, AdminActionError } from "./admin-validation";

// Stable IDs match the existing dashboard data; labels may evolve independently.
export const dashboardKpis = [
  { id: "totalUsers", label: "Total des utilisateurs", icon: "users", essential: true },
  { id: "totalClients", label: "Total des clients", icon: "client", essential: true },
  { id: "totalProfessionals", label: "Total des prestataires", icon: "professional", essential: true },
  { id: "pendingProfessionals", label: "Prestataires à vérifier", icon: "clock", essential: true },
  { id: "approvedProfessionals", label: "Prestataires approuvés", icon: "check", essential: false },
  { id: "totalRequests", label: "Demandes", icon: "requests", essential: true },
  { id: "completedRequests", label: "Interventions terminées", icon: "check", essential: true },
  { id: "openComplaints", label: "Réclamations à traiter", icon: "complaint", essential: true },
  { id: "totalReviews", label: "Avis clients", icon: "star", essential: false },
  { id: "grossTnd", label: "Volume encaissé · Test", icon: "money", essential: false },
  { id: "netTnd", label: "Revenu HomeFix TN", icon: "money", essential: true },
  { id: "openReports", label: "Signalements ouverts", icon: "flag", essential: false },
] as const;

export const dashboardWidgets = [
  { id: "signups", label: "Évolution des inscriptions", description: "Les nouveaux comptes au fil de la période.", icon: "users", preview: "line", essential: true },
  { id: "completed", label: "Évolution des interventions", description: "Les interventions terminées au fil du temps.", icon: "requests", preview: "line", essential: true },
  { id: "categories", label: "Répartition par catégorie", description: "Les catégories de demandes les plus actives.", icon: "category", preview: "bars", essential: true },
  { id: "statuses", label: "Répartition par statut", description: "La distribution des demandes par statut.", icon: "chart", preview: "donut", essential: false },
  { id: "latestAudit", label: "Dernières actions Admin", description: "Les dernières actions du journal d’audit.", icon: "activity", preview: "list", essential: false },
  { id: "latestOperations", label: "Dernières opérations", description: "Utilisateurs, prestataires, demandes et réclamations.", icon: "clock", preview: "list", essential: true },
  { id: "quickLinks", label: "Accès rapides", description: "Vos raccourcis vers la gestion de la plateforme.", icon: "links", preview: "links", essential: true },
] as const;

export type DashboardKpiId = (typeof dashboardKpis)[number]["id"];
export type DashboardWidgetId = (typeof dashboardWidgets)[number]["id"];
export type DashboardPreferences = { kpis: DashboardKpiId[]; widgets: DashboardWidgetId[] };

export function defaultDashboardPreferences(): DashboardPreferences {
  return {
    kpis: dashboardKpis.filter(item => item.essential).map(item => item.id),
    widgets: dashboardWidgets.filter(item => item.essential).map(item => item.id),
  };
}

export function validateDashboardPreferences(value: unknown): DashboardPreferences {
  const input = adminObject(value, ["kpis", "widgets"]);
  function selection<T extends string>(value: unknown, allowed: readonly T[]): T[] {
    if (!Array.isArray(value) || value.length > allowed.length ||
      value.some(id => typeof id !== "string" || !allowed.includes(id as T)) ||
      new Set(value).size !== value.length) {
      throw new AdminActionError("Sélection d’indicateurs ou de widgets invalide.");
    }
    // Use catalog order to keep the dashboard and its preview consistent.
    return allowed.filter(id => value.includes(id));
  }
  return {
    kpis: selection(input.kpis, dashboardKpis.map(item => item.id)),
    widgets: selection(input.widgets, dashboardWidgets.map(item => item.id)),
  };
}

export function readDashboardPreferences(value: unknown): DashboardPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultDashboardPreferences();
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.kpis) || !Array.isArray(input.widgets)) return defaultDashboardPreferences();
  // Ignore retired IDs while preserving an intentionally empty selection.
  return {
    kpis: dashboardKpis.filter(item => (input.kpis as unknown[]).includes(item.id)).map(item => item.id),
    widgets: dashboardWidgets.filter(item => (input.widgets as unknown[]).includes(item.id)).map(item => item.id),
  };
}
